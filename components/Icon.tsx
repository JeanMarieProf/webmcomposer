import React from 'react';

// Simplified SVG icons to avoid external dependencies for this demo
export const Icons = {
  Play: () => <path d="M5 3l14 9-14 9V3z" />,
  Pause: () => <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />,
  Upload: () => <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  Scissors: () => <path d="M6 9l6 6 6-6" />, // Simplified representation
  Crop: () => (
    <>
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" strokeLinecap="round" strokeLinejoin="round"/>
    </>
  ),
  Volume2: () => <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />,
  VolumeX: () => <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />,
  Download: () => <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  Layers: () => <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  Trash: () => <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
};

interface IconProps extends React.SVGProps<SVGSVGElement> {
  icon: keyof typeof Icons;
  size?: number;
}

export const Icon: React.FC<IconProps> = ({ icon, size = 24, className, ...props }) => {
  const Path = Icons[icon];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <Path />
    </svg>
  );
};
