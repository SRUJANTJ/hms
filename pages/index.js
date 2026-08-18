import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const role = data.user.role;

        if (role === "admin") {
          router.replace("/admin");
        } else if (role === "warden") {
          router.replace("/warden");
        }
/* else {
          router.replace("/student");
        }*\
      })
      .catch(() => {
        router.replace("/warden/login");
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      Loading...
    </div>
  );
}