import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { auth, firestore } from "./config";
import { isAllowedTDTUEmail, NOMINATED_OWNER_EMAIL } from "./policy";
import type { UserProfile, SharedPersonnelRecord } from "../types";

export type AuthStatus =
  | "initializing"
  | "unauthenticated"
  | "authenticated"
  | "unprovisioned"
  | "invalid_domain"
  | "disabled"
  | "error";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  authStatus: AuthStatus;
  loading: boolean;
  error: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("initializing");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Lock to prevent concurrent profile fetches / race conditions
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);

  const executeProfileLoad = async (firebaseUser: User): Promise<void> => {
    const email = firebaseUser.email?.trim().toLowerCase() || "";

    // Check 1: Domain verification
    if (!isAllowedTDTUEmail(email)) {
      setUser(firebaseUser);
      setProfile(null);
      setAuthStatus("invalid_domain");
      setError(
        `Chỉ chấp nhận tài khoản email @tdtu.edu.vn của Trường Đại học Tôn Đức Thắng. Tài khoản hiện tại (${email}) không hợp lệ.`
      );
      return;
    }

    // Check 2: Direct document lookup by Firebase Auth UID
    const userDocRef = doc(firestore, "users", firebaseUser.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      if (!data.active) {
        setUser(firebaseUser);
        setProfile(null);
        setAuthStatus("disabled");
        setError("Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Ban Chủ nhiệm.");
        return;
      }
      const loadedProfile: UserProfile = { ...data, id: userSnap.id, uid: firebaseUser.uid };
      setUser(firebaseUser);
      setProfile(loadedProfile);
      setAuthStatus("authenticated");
      setError("");
      return;
    }

    // Check 3: Nominated Owner Bootstrap
    if (email === NOMINATED_OWNER_EMAIL.toLowerCase()) {
      // Check if there is an existing provisioned doc for the owner
      const provQ = query(collection(firestore, "users"), where("email", "==", email), limit(1));
      const provSnap = await getDocs(provQ).catch(() => null);
      const provDoc = provSnap && !provSnap.empty ? provSnap.docs[0] : null;
      const provData = provDoc ? (provDoc.data() as Partial<UserProfile>) : null;

      const now = new Date().toISOString();
      const ownerProfile: UserProfile = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email,
        name: provData?.name || firebaseUser.displayName || "Trần Quang Hải",
        role: "owner",
        department: provData?.department || "Khoa Mỹ thuật Công nghiệp",
        academicDegree: provData?.academicDegree || "ThS",
        active: true,
        photoURL: firebaseUser.photoURL || "",
        createdAt: provData?.createdAt || now,
        updatedAt: now,
        linkedAt: now,
      };

      await setDoc(userDocRef, ownerProfile);

      // Clean up old provisional doc if its ID differs from UID
      if (provDoc && provDoc.id !== firebaseUser.uid) {
        await deleteDoc(provDoc.ref).catch((e) => console.warn("Owner prov doc cleanup note:", e));
      }

      setUser(firebaseUser);
      setProfile(ownerProfile);
      setAuthStatus("authenticated");
      setError("");
      return;
    }

    // Check 4: Pre-provisioned user lookup by email
    // Fast path: Check direct provisional document IDs first
    let provDoc: { id: string; ref: any; data: () => any } | null = null;

    // 4a. Check direct standard ID: prov_email (e.g. prov_nguyenthithuyha1@tdtu.edu.vn)
    const provDirectRef = doc(firestore, "users", `prov_${email}`);
    const provDirectSnap = await getDoc(provDirectRef).catch(() => null);
    if (provDirectSnap && provDirectSnap.exists()) {
      provDoc = provDirectSnap;
    }

    // 4b. Check sanitized legacy ID: prov_email_sanitized (e.g. prov_nguyenthithuyha1_tdtu_edu_vn)
    if (!provDoc) {
      const legacyId = `prov_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const legacyRef = doc(firestore, "users", legacyId);
      const legacySnap = await getDoc(legacyRef).catch(() => null);
      if (legacySnap && legacySnap.exists()) {
        provDoc = legacySnap;
      }
    }

    // 4c. Fallback query by email field
    if (!provDoc) {
      const q = query(collection(firestore, "users"), where("email", "==", email), limit(1));
      const querySnap = await getDocs(q).catch(() => null);
      if (querySnap && !querySnap.empty) {
        provDoc = querySnap.docs[0];
      }
    }

    if (provDoc) {
      const provData = provDoc.data() as UserProfile;

      if (!provData.active) {
        setUser(firebaseUser);
        setProfile(null);
        setAuthStatus("disabled");
        setError("Tài khoản của bạn đã bị vô hiệu hóa.");
        return;
      }

      // Link provisioned data to actual Firebase Auth UID
      // CRITICAL: Preserve role! If Admin, keep role === 'admin'!
      const updatedProfile: UserProfile = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email,
        name: provData.name || firebaseUser.displayName || email,
        role: provData.role || "lecturer",
        department: provData.department || "",
        academicDegree: provData.academicDegree || "",
        orcid: provData.orcid || "",
        googleScholar: provData.googleScholar || "",
        researchGate: provData.researchGate || "",
        website: provData.website || "",
        active: true,
        photoURL: firebaseUser.photoURL || provData.photoURL || "",
        createdAt: provData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        linkedAt: new Date().toISOString(),
        ...(provData.promotedAt ? { promotedAt: provData.promotedAt } : {}),
        ...(provData.promotedBy ? { promotedBy: provData.promotedBy } : {}),
      };

      await setDoc(userDocRef, updatedProfile);

      // Clean up provisional documents (ignore errors if permissions don't allow delete)
      if (provDoc.id !== firebaseUser.uid) {
        await deleteDoc(provDoc.ref).catch(() => {});
      }
      const altLegacyId = `prov_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
      if (altLegacyId !== provDoc.id) {
        await deleteDoc(doc(firestore, "users", altLegacyId)).catch(() => {});
      }
      const altStandardId = `prov_${email}`;
      if (altStandardId !== provDoc.id) {
        await deleteDoc(doc(firestore, "users", altStandardId)).catch(() => {});
      }

      setUser(firebaseUser);
      setProfile(updatedProfile);
      setAuthStatus("authenticated");
      setError("");
      return;
    }

    // Check 4d: Check sharedPersonnel directory mirror from IFA-WORK (only for unprovisioned users)
    const sharedDocRef = doc(firestore, "sharedPersonnel", email);
    const sharedSnap = await getDoc(sharedDocRef).catch(() => null);
    if (sharedSnap && sharedSnap.exists()) {
      const sharedData = sharedSnap.data() as SharedPersonnelRecord;
      if (!sharedData.active) {
        setUser(firebaseUser);
        setProfile(null);
        setAuthStatus("disabled");
        setError("Tài khoản của bạn đã ngừng hoạt động trong danh bạ IFA-WORK.");
        return;
      }

      const now = new Date().toISOString();
      const newProfile: UserProfile = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email,
        name: sharedData.displayName || firebaseUser.displayName || email,
        role: "lecturer",
        department: sharedData.departmentName || "Khoa Mỹ thuật Công nghiệp",
        academicDegree: sharedData.academicDegree || "ThS",
        active: true,
        photoURL: firebaseUser.photoURL || "",
        createdAt: now,
        updatedAt: now,
        linkedAt: now,
      };

      await setDoc(userDocRef, newProfile);

      setUser(firebaseUser);
      setProfile(newProfile);
      setAuthStatus("authenticated");
      setError("");
      return;
    }

    // Check 5: Account is @tdtu.edu.vn but NOT provisioned in system roster
    setUser(firebaseUser);
    setProfile(null);
    setAuthStatus("unprovisioned");
    setError("Tài khoản này chưa được cấp quyền sử dụng IFA-RH.");
  };

  const loadUserProfile = async (firebaseUser: User): Promise<void> => {
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    const task = (async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Quá thời gian kết nối đến máy chủ dữ liệu (Timeout 8s). Vui lòng tải lại trang hoặc kiểm tra kết nối mạng."
              )
            );
          }, 8000);
        });

        await Promise.race([executeProfileLoad(firebaseUser), timeoutPromise]);
      } catch (err: any) {
        console.error("Error loading user profile:", err);
        setError(err.message || "Lỗi kiểm tra quyền truy cập.");
        setProfile(null);
        setAuthStatus("error");
      } finally {
        setLoading(false);
        inFlightPromiseRef.current = null;
      }
    })();

    inFlightPromiseRef.current = task;
    return task;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setLoading(true);
        await loadUserProfile(currentUser);
      } else {
        setUser(null);
        setProfile(null);
        setAuthStatus("unauthenticated");
        setError("");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle profile loading deterministically
    } catch (err: any) {
      console.error("Login popup error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        // User voluntarily dismissed popup, keep state clean
        setError("");
      } else {
        setError(err.message || "Đăng nhập thất bại.");
      }
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setAuthStatus("unauthenticated");
      setError("");
    } catch (err: any) {
      console.error("Logout error:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        authStatus,
        loading,
        error,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
