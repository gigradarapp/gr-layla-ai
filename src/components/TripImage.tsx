import { useEffect, useState } from 'react'
import { TRIP_IMAGE_FALLBACK } from '../../shared/destinationImages'

type TripImageProps = {
  src: string
  alt?: string
  className?: string
}

export function TripImage({ src, alt = '', className }: TripImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src)

  useEffect(() => {
    setCurrentSrc(src)
  }, [src])

  return (
    <img
      className={className}
      src={currentSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (currentSrc !== TRIP_IMAGE_FALLBACK) setCurrentSrc(TRIP_IMAGE_FALLBACK)
      }}
    />
  )
}
