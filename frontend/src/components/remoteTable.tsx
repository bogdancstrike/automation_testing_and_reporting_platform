import { Button, Input, Space } from "antd";
import { CloseCircleOutlined, SearchOutlined } from "@ant-design/icons";
import type { QueryParams } from "../api/types";

type FilterOption = { text: string; value: string };

function keysFromParam(value: QueryParams[string], multiple = false): string[] | null {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value);
  return multiple ? text.split(",").filter(Boolean) : [text];
}

export function apiSortOrder(order?: string | null) {
  return order === "ascend" ? "asc" : order === "descend" ? "desc" : undefined;
}

export function antSortOrder(params: QueryParams, field: string) {
  if (params.sort !== field) return null;
  return params.order === "desc" ? "descend" : "ascend";
}

export function textFilter(paramKey: string, params: QueryParams, placeholder: string) {
  return {
    key: paramKey,
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
      <div style={{ padding: 8, width: 230 }} onClick={(event) => event.stopPropagation()}>
        <Input
          autoFocus
          allowClear
          placeholder={placeholder}
          value={selectedKeys[0]}
          onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
          onPressEnter={() => confirm()}
          style={{ marginBottom: 8, display: "block" }}
        />
        <Space>
          <Button type="primary" size="small" icon={<SearchOutlined />} onClick={() => confirm()}>
            Search
          </Button>
          <Button
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={() => {
              clearFilters?.();
              confirm();
            }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />,
    filteredValue: keysFromParam(params[paramKey]),
  };
}

export function textFilterLocal(dataIndex: string, placeholder: string) {
  return {
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
      <div style={{ padding: 8, width: 230 }} onClick={(event) => event.stopPropagation()}>
        <Input
          autoFocus
          allowClear
          placeholder={placeholder}
          value={selectedKeys[0]}
          onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
          onPressEnter={() => confirm()}
          style={{ marginBottom: 8, display: "block" }}
        />
        <Space>
          <Button type="primary" size="small" icon={<SearchOutlined />} onClick={() => confirm()}>
            Search
          </Button>
          <Button
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={() => {
              clearFilters?.();
              confirm();
            }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />,
    onFilter: (value: any, record: any) => String(record[dataIndex] || "").toLowerCase().includes(String(value).toLowerCase()),
  };
}

export function menuFilter(
  paramKey: string,
  params: QueryParams,
  options: FilterOption[],
  multiple = false,
) {
  return {
    key: paramKey,
    filters: options,
    filterMultiple: multiple,
    filterSearch: options.length > 8,
    filteredValue: keysFromParam(params[paramKey], multiple),
  };
}

export function nextTableParams(
  prev: QueryParams,
  pagination: any,
  filters: Record<string, any>,
  sorter: any,
  extra: any,
  filterMap: Record<string, string>,
  defaults: { sort: string; order: "asc" | "desc"; pageSize?: number },
): QueryParams {
  const activeSorter = Array.isArray(sorter) ? sorter.find((item) => item.order) : sorter;
  const order = apiSortOrder(activeSorter?.order);
  const sort = order ? (activeSorter?.field || activeSorter?.columnKey || defaults.sort) : defaults.sort;
  const next: QueryParams = {
    ...prev,
    page: extra?.action === "filter" ? 1 : pagination.current || 1,
    page_size: pagination.pageSize || defaults.pageSize || 20,
    sort,
    order: order || defaults.order,
  };

  Object.entries(filterMap).forEach(([tableKey, paramKey]) => {
    const values = filters?.[tableKey];
    next[paramKey] = values && values.length ? values.map(String).join(",") : undefined;
  });

  return next;
}
