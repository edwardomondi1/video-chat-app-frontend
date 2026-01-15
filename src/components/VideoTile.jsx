// src/components/VideoTile.jsx
export default function VideoTile({ name }) {
  return (
    <div className="w-full h-full bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg shadow-md">
      {name}
    </div>
  );
}

