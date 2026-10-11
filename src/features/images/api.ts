import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];

// 弹出系统文件选择器，让用户从本地磁盘选取一张或多张图片
export async function pickLocalImages(): Promise<string[]> {
  const result = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
  });

  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

export function saveImage(noteId: string, data: Uint8Array, extension: string): Promise<string> {
  // 图片字节流作为 raw payload 直传（元数据走 headers），避免把二进制
  // 展开成 JS 数字数组再 JSON 序列化造成的巨大瞬时内存开销
  return invoke("images_save", data, {
    headers: { "x-note-id": noteId, "x-image-ext": extension },
  });
}

export function saveImageFromPath(noteId: string, filePath: string): Promise<string> {
  return invoke("images_save_from_path", { noteId, filePath });
}

export function getImagesBaseDir(): Promise<string> {
  return invoke("images_get_base_dir");
}

// 读取应用自身"图片目录"之外的本地图片（如外部 md 文档相对/绝对路径引用的图片），
// 返回 data URL，避免依赖资源协议的目录放行机制
export function readLocalImage(path: string): Promise<string> {
  return invoke("read_local_image", { path });
}

export function cleanUnusedImages(noteId: string, content: string): Promise<string[]> {
  return invoke("images_clean_unused", { noteId, content });
}
