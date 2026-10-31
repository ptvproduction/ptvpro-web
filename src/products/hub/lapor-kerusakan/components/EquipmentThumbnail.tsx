import React, { useState } from "react";
import { Camera, Aperture, Mic, Sun, Radio, Wrench, Box } from "lucide-react";

interface EquipmentThumbnailProps {
  category: string;
  assetName: string;
  photoUrl?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  onClick?: () => void;
}

export const EquipmentThumbnail: React.FC<EquipmentThumbnailProps> = ({
  category,
  assetName,
  photoUrl,
  size = "md",
  className = "",
  onClick,
}) => {
  const [hasError, setHasError] = useState(false);

  const getCategoryIcon = () => {
    const cat = (category || "").toLowerCase();
    const iconSize = size === "sm" ? 20 : size === "md" ? 28 : size === "lg" ? 36 : 48;

    if (cat.includes("kamera") || cat.includes("camera")) {
      return <Camera size={iconSize} className="dmg-equip-icon" />;
    }
    if (cat.includes("lensa") || cat.includes("lens")) {
      return <Aperture size={iconSize} className="dmg-equip-icon" />;
    }
    if (cat.includes("audio") || cat.includes("mic")) {
      return <Mic size={iconSize} className="dmg-equip-icon" />;
    }
    if (cat.includes("light") || cat.includes("lampu")) {
      return <Sun size={iconSize} className="dmg-equip-icon" />;
    }
    if (cat.includes("stream") || cat.includes("switch") || cat.includes("broadcast")) {
      return <Radio size={iconSize} className="dmg-equip-icon" />;
    }
    if (cat.includes("alat") || cat.includes("rig") || cat.includes("tripod")) {
      return <Wrench size={iconSize} className="dmg-equip-icon" />;
    }
    return <Box size={iconSize} className="dmg-equip-icon" />;
  };

  const hasValidPhoto = Boolean(photoUrl && !hasError);

  return (
    <div
      className={`dmg-equip-thumb-box size-${size} ${hasValidPhoto ? "has-img" : "is-placeholder"} ${className}`}
      onClick={onClick}
      title={assetName}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {hasValidPhoto ? (
        <img
          src={photoUrl}
          alt={assetName}
          className="dmg-equip-thumb-img"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      ) : (
        <div className="dmg-equip-placeholder-inner">
          {getCategoryIcon()}
          {size !== "sm" && (
            <span className="dmg-equip-placeholder-label">{category || "Studio"}</span>
          )}
        </div>
      )}
    </div>
  );
};
