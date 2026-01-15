// src/components/LoginModal.jsx
import React from "react";

export default function LoginModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-blue-200 bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md relative">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 font-bold text-lg"
        >
          ×
        </button>

        {/* Title */}
        <h2 className="text-2xl font-bold text-blue-600 mb-6 text-center">
          Login
        </h2>

        {/* Form */}
        <form className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="password"
            placeholder="Password"
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <button
            type="submit"
            className="py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition mt-2"
          >
            Login
          </button>
        </form>

      </div>
    </div>
  );
}
