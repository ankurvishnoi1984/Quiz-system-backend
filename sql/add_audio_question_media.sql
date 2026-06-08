-- Enable audio uploads for question media and media assets.
ALTER TABLE questions
  MODIFY media_type ENUM('image', 'gif', 'video_file', 'video_embed', 'audio_file') DEFAULT NULL;

ALTER TABLE media_assets
  MODIFY media_type ENUM('image', 'gif', 'video_file', 'audio_file') NOT NULL;
