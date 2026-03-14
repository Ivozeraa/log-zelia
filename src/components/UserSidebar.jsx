export const UserSidebar = ({ open }) => {
  return (
    <div
      className={`fixed top-0 right-0 h-screen w-72 bg-white shadow-lg z-50
      transform transition-all duration-250 ease-in-out
      ${open ? "translate-x-0" : "translate-x-full"}`}
    >

    </div>
  )
}