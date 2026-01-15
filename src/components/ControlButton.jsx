import { useState } from "react";
import {
  MicrophoneIcon,
  VideoCameraIcon,
  PhoneXMarkIcon,
} from "@heroicons/react/24/solid";

export default function ControlButton({ type, onClick }) {
  const [active, setActive] = useState(true);

  let icon;
  let bg = "bg-blue-600";

  // Toggle icon for mic/camera and background slightly
  if (type === "mute") {
    icon = active
      ? <MicrophoneIcon className="w-8 h-8 text-blue-600" />
      : <MicrophoneIcon className="w-8 h-8 text-blue-600" />;
    bg = active ? "bg-blue-600" : "bg-blue-300"; // lighter when off
  }

  if (type === "camera") {
    icon = active
      ? <VideoCameraIcon className="w-8 h-8 text-blue-600" />
      : <VideoCameraIcon className="w-8 h-8 text-blue-600" />;
    bg = active ? "bg-blue-600" : "bg-blue-300"; // lighter when off
  }

  if (type === "leave") {
    icon = <PhoneXMarkIcon className="w-8 h-8 text-blue-600" />;
    bg = "bg-red-600";
  }

  const handleClick = () => {
    if (type === "mute" || type === "camera") setActive(!active);
    if (onClick) onClick(active);
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center justify-center p-4 rounded-full shadow-xl ${bg} hover:brightness-110 transition`}
    >
      {icon}
    </button>
  );
}
