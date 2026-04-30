import { toast } from 'react-toastify'

export const notify = {
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg),
  warning: (msg) => toast.warning(msg),
  info: (msg) => toast.info(msg),
}