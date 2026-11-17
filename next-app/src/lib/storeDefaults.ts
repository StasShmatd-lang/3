import { customAlphabet } from "nanoid";

const nano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

const DEFAULT_MISSIONS = [
  "Селфи с коллегой из другого отдела",
  "Найди что-то зелёное и сфотографируй",
  "Самая смешная поза с другом",
  "Кадр с логотипом компании",
  "Фото «мы уже легенды»",
];

/** Client-safe mission drafts (no server/crypto imports). */
export function defaultMissionDrafts() {
  return DEFAULT_MISSIONS.map((text) => ({ id: nano(), text, refPhoto: "" }));
}
