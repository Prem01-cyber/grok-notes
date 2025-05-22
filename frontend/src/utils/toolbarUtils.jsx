import React from "react";

export const CollapseButton = ({ isCollapsed, onToggle, position, theme }) => {
  const positionClasses =
    position === "right" ? "absolute -left-3 top-4" : "absolute -right-3 top-4";
  const bgClasses =
    theme === "dark"
      ? "bg-gray-700 border-gray-600 hover:bg-gray-600 text-white"
      : "bg-white border-gray-300 hover:bg-gray-50 text-gray-800";

  return (
    <button
      onClick={onToggle}
      className={`${positionClasses} ${bgClasses} p-1 shadow-sm transition-colors z-50 rounded-full`}
      style={{ zIndex: 60 }}
    >
      <svg
        className={`w-4 h-4 transform transition-transform ${
          isCollapsed
            ? position === "right"
              ? "rotate-180"
              : ""
            : position === "right"
            ? ""
            : "rotate-180"
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  );
};
