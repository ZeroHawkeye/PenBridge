import { Select } from "antd";

// 掘金固定分类列表
const JUEJIN_CATEGORIES = [
  { category_id: "6809637767543259144", category_name: "前端" },
  { category_id: "6809637769959178254", category_name: "后端" },
  { category_id: "6809635626879549454", category_name: "Android" },
  { category_id: "6809635626661445640", category_name: "iOS" },
  { category_id: "6809637773935378440", category_name: "人工智能" },
  { category_id: "6809637771511070734", category_name: "开发工具" },
  { category_id: "6809637776263217160", category_name: "代码人生" },
  { category_id: "6809637772874219534", category_name: "阅读" },
];

interface JuejinCategorySelectProps {
  value?: string;
  onChange?: (value: string) => void;
  getPopupContainer?: () => HTMLElement;
}

/**
 * 掘金分类选择组件
 * 使用固定的分类列表
 */
export function JuejinCategorySelect({
  value,
  onChange,
  getPopupContainer,
}: JuejinCategorySelectProps) {
  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder="请选择分类"
      className="w-full"
      options={JUEJIN_CATEGORIES.map((cat) => ({
        value: cat.category_id,
        label: cat.category_name,
      }))}
      getPopupContainer={getPopupContainer}
    />
  );
}

export default JuejinCategorySelect;
