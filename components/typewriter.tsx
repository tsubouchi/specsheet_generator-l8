"use client"

import { useEffect, useState, useRef } from "react"
import { Markdown } from "@/components/markdown"

interface TypewriterProps {
  text: string
  speed?: number
}

export function Typewriter({ text, speed = 10 }: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [isComplete, setIsComplete] = useState(false)
  const textRef = useRef(text)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Reset if text changes
    if (text !== textRef.current) {
      textRef.current = text
      setDisplayedText("")
      setIsComplete(false)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    // If already complete or no text, do nothing
    if (isComplete || !text) return

    let currentIndex = displayedText.length

    // If we've reached the end of the text
    if (currentIndex >= text.length) {
      setIsComplete(true)
      return
    }

    // Type the next character
    const typeNextChar = () => {
      setDisplayedText(text.substring(0, currentIndex + 1))
      currentIndex++

      // If we haven't reached the end, schedule the next character
      if (currentIndex < text.length) {
        timeoutRef.current = setTimeout(typeNextChar, speed)
      } else {
        setIsComplete(true)
      }
    }

    // Start typing
    timeoutRef.current = setTimeout(typeNextChar, speed)

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [text, displayedText, isComplete, speed])

  // If text is empty, show nothing
  if (!text) return null

  return (
    <div className="w-full bg-white">
      <Markdown content={isComplete ? text : displayedText} />
    </div>
  )
}
