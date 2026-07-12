import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Layout from "./Layout";

export default function ProtectedRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}
