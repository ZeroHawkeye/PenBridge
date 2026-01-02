// Milkdown 编辑器包装器 - 实现统一的编辑器接口
import { forwardRef } from "react";
import MilkdownEditor, { type MilkdownEditorRef } from "../MilkdownEditor";
import type { BaseEditorProps, EditorRef } from "./types";

export interface MilkdownEditorWrapperProps extends BaseEditorProps {}

// 包装 MilkdownEditor，确保它实现 EditorRef 接口
const MilkdownEditorWrapper = forwardRef<EditorRef, MilkdownEditorWrapperProps>(
  (props, ref) => {
    return (
      <MilkdownEditor
        ref={ref as React.ForwardedRef<MilkdownEditorRef>}
        {...props}
      />
    );
  }
);

MilkdownEditorWrapper.displayName = "MilkdownEditorWrapper";

export default MilkdownEditorWrapper;
