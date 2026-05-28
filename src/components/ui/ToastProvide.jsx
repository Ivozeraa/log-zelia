import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const ToastProvider = () => {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      theme="dark"
      newestOnTop
      pauseOnHover
      style={{ zIndex: 20000 }}
      toastStyle={{
        zIndex: 20000,
        background: "#020617",
        color: "#e2e8f0",
        border: "1px solid #1e293b",
      }}
      progressStyle={{
        background: "#16a34a",
      }}
    />
  );
};