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
import type { UserProfile } from "../types";

export type AuthStatus =
  | "initializing"
  | "unauthenticated"
  | "authenticated"
  | "unprovisioned"
  | "invalid_domain"
  | "disabled";

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

  const loadUserProfile = async (firebaseUser: User): Promise<void> => {
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    const task = (async () => {
      try {
        const email = firebaseUser.email?.trim().toLowerCase() || "";

        // Check 1: Domain verification
        if (!isAllowedTDTUEmail(email)) {
          setUser(firebaseUser);
          setProfile(null);
          setAuthStatus("invalid_domain");
          setError(`Chỉ chấp nhận tài khoản email @tdtu.edu.vn của Trường Đại học Tôn Đức Thắng. Tài khoản hiện tại (${email}) không hợp lệ.`);
          setLoading(false);
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
            setLoading(false);
            return;
          }
          const loadedProfile: UserProfile = { ...data, id: userSnap.id, uid: firebaseUser.uid };
          setUser(firebaseUser);
          setProfile(loadedProfile);
          setAuthStatus("authenticated");
          setError("");
          setLoading(false);
          return;
        }

        // Check 3: Nominated Owner Bootstrap
        if (email === NOMINATED_OWNER_EMAIL.toLowerCase()) {
          // Check if there is an existing provisioned doc for the owner
          const provQ = query(collection(firestore, "users"), where("email", "==", email), limit(1));
          const provSnap = await getDocs(provQ);
          const provDoc = !provSnap.empty ? provSnap.docs[0] : null;
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
          setLoading(false);
          return;
        }

        // Check 4: Pre-provisioned user lookup by email
        const q = query(collection(firestore, "users"), where("email", "==", email), limit(1));
        const querySnap = await getDocs(q);

        if (!querySnap.empty) {
          const provDoc = querySnap.docs[0];
          const provData = provDoc.data() as UserProfile;

          if (!provData.active) {
            setUser(firebaseUser);
            setProfile(null);
            setAuthStatus("disabled");
            setError("Tài khoản của bạn đã bị vô hiệu hóa.");
            setLoading(false);
            return;
          }

          // Link provisioned data to actual Firebase Auth UID
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
            photoURL: firebaseUser.photoURL || "",
            createdAt: provData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            linkedAt: new Date().toISOString(),
          };

          await setDoc(userDocRef, updatedProfile);

          // Delete provisional document if ID differs to prevent duplicates
          if (provDoc.id !== firebaseUser.uid) {
            await deleteDoc(provDoc.ref).catch((e) => console.warn("Lecturer prov doc cleanup note:", e));
          }

          setUser(firebaseUser);
          setProfile(updatedProfile);
          setAuthStatus("authenticated");
          setError("");
          setLoading(false);
          return;
        }

        // Check 5: Account is @tdtu.edu.vn but NOT provisioned in system roster
        setUser(firebaseUser);
        setProfile(null);
        setAuthStatus("unprovisioned");
        setError("Tài khoản này chưa được cấp quyền sử dụng IFA-RH.");
        setLoading(false);
      } catch (err: any) {
        console.error("Error loading user profile:", err);
        setError(err.message || "Lỗi kiểm tra quyền truy cập.");
        setProfile(null);
        setLoading(false);
      } finally {
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
