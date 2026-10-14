// ==========================================
// KINGDOM 1269 - CENTRAL AUTH & RBAC CORE
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, OAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// إعدادات Firebase الخاصة بالمشروع
const firebaseConfig = {
    apiKey: "AIzaSyA9WCd_D9kKxFb6xP4IcWK46itFWNOuU5g",
    authDomain: "kingdom-1269-portal.firebaseapp.com",
    projectId: "kingdom-1269-portal",
    storageBucket: "kingdom-1269-portal.firebasestorage.app",
    messagingSenderId: "1007373803222",
    appId: "1:1007373803222:web:bcb85595a99da596aaf377"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const discordProvider = new OAuthProvider('oidc.kingdom-1269'); // أو oidc.discord حسب إعداداتك

// دالة تسجيل الدخول عبر ديسكورد
export async function loginWithDiscord() {
    try {
        await signInWithPopup(auth, discordProvider);
    } catch (error) {
        console.error("Discord Login Error:", error);
        // التبديل إلى Redirect في حال منع النوافذ المنبثقة
        await signInWithRedirect(auth, discordProvider);
    }
}

// دالة تسجيل الخروج
export async function logoutUser() {
    await signOut(auth);
    window.location.href = "index.html";
}

// مراقب حالة المستخدم والتحقق من الصلاحيات والبروفايل
export function initAuthGuard(requiredPageName, requiredPermission = "read") {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // إذا لم يكن مسجل دخول، وتم توجيهه لصفحة تتطلب صلاحية، نعيده للرئيسية أو نظهر زر الدخول
            const isHome = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/");
            if (!isHome) {
                alert("يجب تسجيل الدخول عبر ديسكورد أولاً للوصول إلى هذه الصفحة.");
                window.location.href = "index.html";
            }
            return;
        }

        // جلب بيانات المستخدم من Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists() || !userSnap.data().gameId || !userSnap.data().nickname) {
            // إذا كان مستخدماً جديداً ولم يسجل النيكنيم والأيدي والتحالف
            if (!window.location.pathname.includes("complete-profile.html")) {
                window.location.href = "complete-profile.html";
            }
            return;
        }

        const userData = userSnap.data();
        
        // تحديث واجهة المستخدم بالصورة والنيكنيم المحلي (وليس ديسكورد)
        updateUserUI(userData, user);

        // التحقق من صلاحيات الصفحات المحمية (إذا لم تكن الصفحة الرئيسية)
        if (requiredPageName && requiredPageName !== "home") {
            const hasAccess = await checkPagePermission(userData.alliance, userData.roles, requiredPageName, requiredPermission);
            if (!hasAccess) {
                alert("ليس لديك صلاحية كافية للوصول إلى هذه الصفحة أو تنفيذ هذا الإجراء.");
                window.location.href = "index.html";
            }
        }
    });
}

// التحقق من جدول الصلاحيات الديناميكي في قاعدة البيانات
async function checkPagePermission(userAlliance, userRoles, pageName, action) {
    // الآدمن العام (مثلاً أنت) مستثنى دائماً ولديه كافة الصلاحيات
    if (userRoles && userRoles.isSuperAdmin) return true;

    try {
        const permRef = doc(db, "permissions_matrix", pageName);
        const permSnap = await getDoc(permRef);
        
        if (!permSnap.exists()) return true; // إذا لم يوجد قيد، نسمح بالوصول الافتراضي
        
        const matrix = permSnap.data();
        // matrix يحدد الصلاحيات حسب التحالف والرتبة (مثلاً matrix[userAlliance] أو matrix.general)
        const allianceRules = matrix[userAlliance] || matrix["all"] || {};
        const userRank = userRoles[userAlliance] || "R1"; // رتبته في هذا التحالف

        return allianceRules[userRank] && allianceRules[userRank][action] === true;
    } catch (e) {
        console.error("Permission check error:", e);
        return false;
    }
}

// تحديث عناصر الـ UI بالصورة والاسم المخصص
function updateUserUI(userData, authUser) {
    const avatarUrl = authUser.photoURL || "./images/IMG_3934.png";
    
    // البحث عن عناصر العرض في الصفحة وتحديثها تلقائياً
    document.querySelectorAll(".user-avatar-element").forEach(el => el.src = avatarUrl);
    document.querySelectorAll(".user-nickname-element").forEach(el => el.textContent = `${userData.nickname} (#${userData.gameId} - ${userData.alliance})`);
}
