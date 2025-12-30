import { useState, useEffect, useRef } from "react";
import { Select, Spin, Tag } from "antd";
import { trpc } from "../utils/trpc";
import type { DefaultOptionType } from "antd/es/select";

interface TagOption {
  tagId: number;
  tagName: string;
}

interface LabelValue {
  value: number;
  label: string;
}

interface TencentTagSelectProps {
  value?: number[];
  onChange?: (tagIds: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  getPopupContainer?: () => HTMLElement;
}

/**
 * 腾讯云标签选择组件
 * 支持搜索腾讯云开发者社区的标签
 */
export function TencentTagSelect({
  value = [],
  onChange,
  placeholder = "搜索并选择标签（发布文章至少需要1个标签）",
  disabled = false,
  getPopupContainer,
}: TencentTagSelectProps) {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  // 存储已选中标签的完整信息（id + name）
  const [selectedLabelValues, setSelectedLabelValues] = useState<LabelValue[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防抖处理搜索值
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchValue.trim()) {
      setDebouncedSearchValue("");
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchValue(searchValue.trim());
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchValue]);

  // 搜索标签 - 只在有内容时才请求
  const { data: searchResults, isLoading } = trpc.sync.searchTags.useQuery(
    { keyword: debouncedSearchValue },
    {
      enabled: debouncedSearchValue.length >= 1,
      staleTime: 30000,
    }
  );

  // 当外部 value 变化且为空时，清空内部状态
  useEffect(() => {
    if (value.length === 0) {
      setSelectedLabelValues([]);
    }
  }, [value]);

  // 处理选择变化
  const handleChange = (newLabelValues: LabelValue[]) => {
    setSelectedLabelValues(newLabelValues);
    onChange?.(newLabelValues.map((item) => item.value));
  };

  // 处理搜索
  const handleSearch = (val: string) => {
    setSearchValue(val);
  };

  // 构建选项列表
  const options: DefaultOptionType[] = (searchResults || []).map(
    (tag: TagOption) => ({
      value: tag.tagId,
      label: tag.tagName,
    })
  );

  // 判断是否正在输入
  const isTyping = searchValue.trim() !== debouncedSearchValue;

  return (
    <Select
      mode="multiple"
      labelInValue
      value={selectedLabelValues}
      placeholder={placeholder}
      disabled={disabled}
      filterOption={false}
      onSearch={handleSearch}
      onChange={handleChange}
      notFoundContent={
        isLoading || isTyping ? (
          <Spin size="small" />
        ) : debouncedSearchValue ? (
          "未找到匹配的标签"
        ) : (
          "请输入关键词搜索标签"
        )
      }
      options={options}
      style={{ width: "100%" }}
      getPopupContainer={getPopupContainer}
      tagRender={(props) => {
        const { label, closable, onClose } = props;
        return (
          <Tag
            color="blue"
            closable={closable}
            onClose={onClose}
            style={{ marginRight: 3 }}
          >
            {label}
          </Tag>
        );
      }}
    />
  );
}

export default TencentTagSelect;
