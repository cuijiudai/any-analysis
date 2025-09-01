import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { FieldAnnotationForm } from './FieldAnnotationForm';
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

describe('FieldAnnotationForm', () => {
  const mockProps = {
    sessionId: 'test-session-id',
    onComplete: jest.fn(),
    onBack: jest.fn(),
  };

  const mockFields = [
    {
      name: 'id',
      type: 'integer',
      suggestedLabel: 'ID',
      sampleValues: [1, 2, 3],
    },
    {
      name: 'name',
      type: 'string',
      suggestedLabel: '姓名',
      sampleValues: ['张三', '李四'],
      annotation: {
        fieldName: 'name',
        label: '用户姓名',
        description: '用户的真实姓名',
      },
    },
  ];

  const mockProgress = {
    totalFields: 2,
    annotatedFields: 1,
    progress: 50,
    missingAnnotations: ['id'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock API responses
    mockedApi.get.mockImplementation((url) => {
      if (url.includes('/fields/')) {
        return Promise.resolve({ data: { fields: mockFields } });
      }
      if (url.includes('/progress/')) {
        return Promise.resolve({ data: mockProgress });
      }
      if (url.includes('/validate/')) {
        return Promise.resolve({
          data: {
            isComplete: false,
            missingFields: ['id'],
            errors: [],
          },
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    mockedApi.post.mockResolvedValue({ data: { success: true } });
  });

  it('renders field annotation form correctly', async () => {
    render(<FieldAnnotationForm {...mockProps} />);

    // Check if the title is rendered
    expect(screen.getByText('字段标注')).toBeInTheDocument();
    
    // Check if the description is rendered
    expect(screen.getByText(/为数据字段添加有意义的标注/)).toBeInTheDocument();

    // Wait for fields to load
    await waitFor(() => {
      expect(screen.getByText('字段标注是可选的，可以跳过直接进入数据分析')).toBeInTheDocument();
    });
  });

  it('displays annotation status correctly', async () => {
    render(<FieldAnnotationForm {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });
  });

  it('loads field data on mount', async () => {
    render(<FieldAnnotationForm {...mockProps} />);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/field-annotation/fields/test-session-id');
      expect(mockedApi.get).toHaveBeenCalledWith('/field-annotation/progress/test-session-id');
    });
  });

  it('handles save annotation', async () => {
    render(<FieldAnnotationForm {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('保存标注')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('保存标注');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/field-annotation/batch-save', {
        sessionId: 'test-session-id',
        annotations: expect.any(Array),
      });
    });
  });

  it('handles auto suggest', async () => {
    mockedApi.get.mockImplementation((url) => {
      if (url.includes('/suggestions/')) {
        return Promise.resolve({
          data: {
            suggestions: [
              {
                fieldName: 'id',
                suggestedLabel: '标识符',
                confidence: 0.9,
                reason: '基于字段名称推断',
              },
            ],
          },
        });
      }
      // Return default mocks for other endpoints
      if (url.includes('/fields/')) {
        return Promise.resolve({ data: { fields: mockFields } });
      }
      if (url.includes('/progress/')) {
        return Promise.resolve({ data: mockProgress });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<FieldAnnotationForm {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('智能标注建议')).toBeInTheDocument();
    });

    const suggestButton = screen.getByText('智能标注建议');
    fireEvent.click(suggestButton);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/field-annotation/suggestions/test-session-id');
    });
  });

  it('always enables complete button since annotation is optional', async () => {
    render(<FieldAnnotationForm {...mockProps} />);

    await waitFor(() => {
      const completeButton = screen.getByText('完成标注，进入数据分析');
      expect(completeButton).not.toBeDisabled();
    });
  });

  it('handles completion flow', async () => {
    render(<FieldAnnotationForm {...mockProps} />);

    await waitFor(() => {
      const completeButton = screen.getByText('完成标注，进入数据分析');
      expect(completeButton).not.toBeDisabled();
    });

    const completeButton = screen.getByText('完成标注，进入数据分析');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(mockProps.onComplete).toHaveBeenCalled();
    });
  });
});