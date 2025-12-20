import React from "react";
import { isImageFile, isVideoFile } from "../utils/fileHelpers";

interface MediaPreviewProps {
  mediaURL: string;
  currentFile: string | null;
}

const MediaPreview: React.FC<MediaPreviewProps> = ({
  mediaURL,
  currentFile,
}) => {
  if (!currentFile) return null;

  if (isImageFile(currentFile)) {
    return (
      <div className="media-preview">
        <img
          src={mediaURL}
          alt={currentFile}
          style={{ maxWidth: "100%", maxHeight: "100%" }}
        />
      </div>
    );
  }

  if (isVideoFile(currentFile)) {
    return (
      <div className="media-preview">
        <video controls style={{ maxWidth: "100%", maxHeight: "100%" }}>
          <source src={mediaURL} />
          <track kind="captions" src="" label="English" srcLang="en" default />
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  return null;
};

export default MediaPreview;
