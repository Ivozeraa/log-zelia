import { useCurrentUserImage } from "../../hooks/useCurrentUserImage"
import { useCurrentUserName } from "../../hooks/useCurrentUserName"

export function CurrentUserAvatar() {

  const image = useCurrentUserImage()
  const name = useCurrentUserName()

  const initials = name
    ?.split(" ")
    ?.filter(Boolean)
    ?.map(n => n[0])
    ?.slice(0, 2)
    ?.join("")
    ?.toUpperCase()

  return (

    <div style={{
      width: 40,
      height: 40,
      borderRadius: "50%",
      overflow: "hidden",
      background: "#ddd",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "bold"
    }}>

      {image ? (
        <img
          src={image}
          alt={name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        />
      ) : (
        <span>{initials || "?"}</span>
      )}

    </div>
  )
}