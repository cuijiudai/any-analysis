import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { DataTable } from './DataTable';
import api from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock antd message
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

describe('DataTable', () => {
  const mockProps = {
    sessionId: 'test-session-id',
    height: 600,
    showToolbar: true,
    showPagination: true,
    defaultPageSize: 20,
  };

  const mockQueryResponse = {
    data: {
      success: true,
      data: [
        { id: 1, name: '张三', age: 25, email: 'zhang@example.com' },
        { id: 2, name: '李四', age: 30, email: 'li@example.com' },
      ],
      fields: [
        { name: 'id', label: 'ID', type: 'integer' },
        { name: 'name', label: '姓名', type: 'string' },
        { name: 'age', label: '年龄', type: 'integer' },
        { name: 'email', label: '邮箱', type: 'email' },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.post.mockResolvedValue(mockQueryResponse);
  });

  it('renders data table correctly', async () => {
    render(<DataTable {...mockProps} />);

    // Check if the title is rendered
    expect(screen.getByText('数据表格')).toBeInTheDocument();
    
    // Check if toolbar buttons are rendered
    expect(screen.getByText('刷新')).toBeInTheDocument();
    expect(screen.getByText('导出CSV')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/data-analysis/query', {
        sessionId: 'test-session-id',
        page: 1,
        pageSize: 20,
        filters: undefined,
        sorts: undefined,
      });
    });
  });

  it('loads data on mount', async () => {
    render(<DataTable {...mockProps} />);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/data-analysis/query', {
        sessionId: 'test-session-id',
        page: 1,
        pageSize: 20,
        filters: undefined,
        sorts: undefined,
      });
    });
  });

  it('handles refresh button click', async () => {
    render(<DataTable {...mockProps} />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledTimes(1);
    });

    // Click refresh button
    const refreshButton = screen.getByText('刷新');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledTimes(2);
    });
  });

  it('handles export functionality', async () => {
    const mockExportResponse = {
      data: {
        success: true,
        data: mockQueryResponse.data.data,
        fields: mockQueryResponse.data.fields,
        total: 2,
        exportedAt: '2023-01-01T00:00:00.000Z',
      },
    };

    mockedApi.post.mockImplementation((url) => {
      if (url === '/data-analysis/export') {
        return Promise.resolve(mockExportResponse);
      }
      return Promise.resolve(mockQueryResponse);
    });

    // Mock URL.createObjectURL and other DOM methods
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    const mockLink = {
      click: jest.fn(),
      setAttribute: jest.fn(),
      style: { visibility: '' },
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    jest.spyOn(document.body, 'appendChild').mockImplementation();
    jest.spyOn(document.body, 'removeChild').mockImplementation();

    render(<DataTable {...mockProps} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('导出CSV')).toBeInTheDocument();
    });

    // Click export button
    const exportButton = screen.getByText('导出CSV');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/data-analysis/export', {
        sessionId: 'test-session-id',
        filters: undefined,
        sorts: undefined,
      });
    });
  });

  it('calls onDataChange when data loads', async () => {
    const onDataChange = jest.fn();
    
    render(<DataTable {...mockProps} onDataChange={onDataChange} />);

    await waitFor(() => {
      expect(onDataChange).toHaveBeenCalledWith(mockQueryResponse.data.data);
    });
  });

  it('handles row selection', async () => {
    const onRowSelect = jest.fn();
    
    render(<DataTable {...mockProps} onRowSelect={onRowSelect} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('数据表格')).toBeInTheDocument();
    });

    // Note: Testing row selection would require more complex setup
    // as it involves Ant Design Table component interactions
  });

  it('handles API errors gracefully', async () => {
    mockedApi.post.mockRejectedValue(new Error('API Error'));

    render(<DataTable {...mockProps} />);

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('加载数据失败');
    });
  });

  it('renders without toolbar when showToolbar is false', () => {
    render(<DataTable {...mockProps} showToolbar={false} />);

    expect(screen.queryByText('数据表格')).not.toBeInTheDocument();
    expect(screen.queryByText('刷新')).not.toBeInTheDocument();
    expect(screen.queryByText('导出CSV')).not.toBeInTheDocument();
  });

  it('renders without pagination when showPagination is false', () => {
    render(<DataTable {...mockProps} showPagination={false} />);

    // The table should still render but without pagination controls
    // This would need more specific testing of the Table component props
  });
});