import { useEffect, useRef } from "react";

// 拖拽调整尺寸期间：禁用文本选择、显示列调整光标，并把鼠标移动交给 onMove 处理
export function useDragResize(
  active: boolean,
  setActive: (active: boolean) => void,
  onMove: (event: MouseEvent) => void,
) {
  // 回调每次渲染都可能变化，用 ref 保持监听器稳定
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const setActiveRef = useRef(setActive);
  setActiveRef.current = setActive;

  useEffect(() => {
    if (!active) return;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (event: MouseEvent) => onMoveRef.current(event);
    const handleMouseUp = () => setActiveRef.current(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [active]);
}
