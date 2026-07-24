import React from "react";

interface HeroBlinkTextProps {

  text: string;

  isMobile?: boolean;

  duration?: number;

  className?: string;

  style?: React.CSSProperties;

}

const HeroBlinkText: React.FC<HeroBlinkTextProps> = ({

  text,

  isMobile = false,

  duration = 1.8,

  className = "",

  style = {}

}) => {

  const defaultStyle: React.CSSProperties = {

    color: "#10b981",

    fontSize: isMobile
      ? "0.85rem"
      : "clamp(1rem,2.0vw,2.2rem)",

    fontWeight: 700,

    letterSpacing: "0.03em",

    textTransform: "uppercase",

    marginBottom: isMobile
      ? "1.5rem"
      : "clamp(0.6rem,2.5vh,3.5rem)",

    lineHeight: "1.1",

    textAlign: "center",

    background: "rgba(16,185,129,0.1)",

    border: "1px solid rgba(16,185,129,0.3)",

    borderRadius: "clamp(10px,2.5vw,16px)",

    padding: isMobile
      ? "0.5rem 1.1rem"
      : "clamp(.4rem,1.5vh,2rem) clamp(1rem,3vw,4rem)",

    backdropFilter: "blur(4px)",

    WebkitBackdropFilter: "blur(4px)",

    boxShadow: "0 2px 8px rgba(16,185,129,0.2)",

    display: "inline-block",

    whiteSpace: "nowrap",

    overflow: "hidden",

    textOverflow: "ellipsis",

    maxWidth: "90%",

    textShadow: "0 1px 4px rgba(0,0,0,0.3)",

   animation: "heroBlink 1.6s ease-in-out infinite",

    willChange: "transform, opacity",

    

  };

  return (

    <div

      className={`heroBlink ${className}`}

      style={{
        ...defaultStyle,
        ...style
      }}

    >

      {text}

    </div>

  );

};

export default HeroBlinkText;