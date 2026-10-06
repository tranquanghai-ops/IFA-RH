import React, { createContext, useContext, useEffect, useState } from "react";
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
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { auth, firestore } from "./config";
import { isAllowedTDTUEmail, NOMINATED_OWNER_EMAIL } from "./policy";
import type { UserProfile } from "../types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const loadUserProfile = async (firebaseUser: User) => {
    try {
      const email = firebaseUser.email?.trim().toLowerCase() || "";
      if (!isAllowedTDTUEmail(email)) {
        await signOut(auth);
        setUser(null);
        setProfile(null);
        setError("Chỉ chấp nhận tài khoản email @tdtu.edu.vn.");
        setLoading(false);
        return;
      }

      // 1. Direct doc lookup by UID
      const userDocRef = doc(firestore, "users", firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        if (!data.active) {
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setError("Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Ban Chủ nhiệm.");
          setLoading(false);
          return;
        }
        setProfile({ ...data, id: userSnap.id, uid: firebaseUser.uid });
        setError("");
        setLoading(false);
        return;
      }

      // 2. Lookup provisioned by email
      const q = query(collection(firestore, "users"), where("email", "==", email), limit(1));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const provDoc = querySnap.docs[0];
        const provData = provDoc.data() as UserProfile;

        if (!provData.active) {
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setError("Tài khoản của bạn đã bị vô hiệu hóa.");
          setLoading(false);
          return;
        }

        // Link provisioned data to actual UID
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
        setProfile(updatedProfile);
        setError("");
        setLoading(false);
        return;
      }

      // 3. Owner bootstrap check: Check if an Owner already exists in system
      const ownerQuery = query(
        collection(firestore, "users"),
        where("role", "==", "owner"),
        limit(1)
      );
      const ownerSnap = await getDocs(ownerQuery);

      if (ownerSnap.empty && email === NOMINATED_OWNER_EMAIL.toLowerCase()) {
        // Safe bootstrap of the first Owner
        const now = new Date().toISOString();
        const ownerProfile: UserProfile = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email,
          name: firebaseUser.displayName || "Trần Quang Hải",
          role: "owner",
          department: "Khoa Mỹ thuật Công nghiệp",
          academicDegree: "ThS",
          active: true,
          photoURL: firebaseUser.photoURL || "",
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(userDocRef, ownerProfile);
        setProfile(ownerProfile);
        setError("");
        setLoading(false);
        return;
      }

      // 4. Unauthorized: email is TDTU but not pre-provisioned in system
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setError(
        "Tài khoản của bạn chưa được cấp quyền trong hệ thống IFA-RH. Vui lòng liên hệ Quản trị viên Khoa Mỹ thuật Công nghiệp để được thêm vào danh sách."
      );
      setLoading(false);
    } catch (err: any) {
      console.error("Error loading user profile:", err);
      setError(err.message || "Lỗi kiểm tra quyền truy cập.");
      setProfile(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        await loadUserProfile(currentUser);
      } else {
        setProfile(null);
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
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        await loadUserProfile(result.user);
      }
    } catch (err: any) {
      console.error("Login popup error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
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
