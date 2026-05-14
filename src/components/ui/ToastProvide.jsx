import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export const ToastProvider = () => {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      theme="light"
      newestOnTop
      pauseOnHover
      style={{ zIndex: 20000 }}
      toastStyle={{ zIndex: 20000 }}
    />
  )
}