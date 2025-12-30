import { useState, useEffect, useRef } from "react";
import { Select, Spin, Tag } from "antd";
import { trpc } from "../utils/trpc";
import type { DefaultOptionType } from "antd/es/select";

interface TagOption {
  tag_id: string;
  tag_name: string;
}

interface LabelValue {
  value: string;
  label: string;
}

interface JuejinTagSelectProps {
  value?: LabelValue[];
  onChange?: (tags: LabelValue[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxCount?: number;
  getPopupContainer?: () => HTMLElement;
}

/**
 * 掘金标签选择组件
 * 支持搜索掘金的标签，最多选择3个
 */
export function JuejinTagSelect({
  value = [],
  onChange,
  placeholder = "搜索并选择标签（至少1个，最多3个）",
  disabled = false,
  maxCount = 3,
  getPopupContainer,
}: JuejinTagSelectProps) {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
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
  const { data: searchResults, isLoading } = trpc.juejin.searchTags.useQuery(
    { keyword: debouncedSearchValue },
    {
      enabled: debouncedSearchValue.length >= 1,
      staleTime: 30000,
    }
  );

  // 处理选择变化
  const handleChange = (newLabelValues: LabelValue[]) => {
    // 限制最多选择 maxCount 个
    if (newLabelValues.length <= maxCount) {
      onChange?.(newLabelValues);
    }
  };

  // 处理搜索
  const handleSearch = (val: string) => {
    setSearchValue(val);
  };

  // 构建选项列表
  const options: DefaultOptionType[] = (searchResults || []).map(
    (tag: TagOption) => ({
      value: tag.tag_id,
      label: tag.tag_name,
    })
  );

  // 判断是否正在输入
  const isTyping = searchValue.trim() !== debouncedSearchValue;

  return (
    <Select
      mode="multiple"
      labelInValue
      value={value}
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
      maxTagCount={maxCount}
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

export default JuejinTagSelect;
