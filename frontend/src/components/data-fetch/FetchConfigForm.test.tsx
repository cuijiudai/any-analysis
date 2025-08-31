import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FetchConfigForm from './FetchConfigForm';
import { FetchConfig } from '../../types';

// Mock the child components
jest.mock('./SmokeTestButton', () => {
  return function MockSmokeTestButton(props: any) {
    return (
      <button 
        data-testid="smoke-test-button"
        disabled={props.disabled}
        onClick={() => props.onTestComplete?.({ success: true, data: [] })}
      >
        测试拉取
      </button>
    );
  };
});

jest.mock('./CurlParserModal', () => {
  return function MockCurlParserModal(props: any) {
    return props.visible ? (
      <div data-testid="curl-parser-modal">
        <button onClick={() => props.onClose()}>关闭</button>
        <button 
          onClick={() => props.onParsed({
            apiUrl: 'https://api.example.com/test',
            headers: { 'Authorization': 'Bearer token' }
          })}
        >
          解析
        </button>
      </div>
    ) : null;
  };
});

jest.mock('./FetchModeSelector', () => {
  return function MockFetchModeSelector(props: any) {
    return (
      <div data-testid="fetch-mode-selector">
        <input 
          type="radio" 
          value="pagination" 
          checked={props.value === 'pagination'}
          onChange={() => props.onChange?.('pagination')}
        />
        <label>分页拉取</label>
        <input 
          type="radio" 
          value="all" 
          checked={props.value === 'all'}
          onChange={() => props.onChange?.('all')}
        />
        <label>全部拉取</label>
      </div>
    );
  };
});

describe('FetchConfigForm', () => {
  const mockProps = {
    onConfigChange: jest.fn(),
    onSmokeTestComplete: jest.fn(),
    onStartFetch: jest.fn(),
    onSaveConfig: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form with all required fields', () => {
    render(<FetchConfigForm {...mockProps} />);
    
    expect(screen.getByText('数据拉取配置')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://api.example.com/data')).toBeInTheDocument();
    expect(screen.getByText('从 Curl 命令导入配置')).toBeInTheDocument();
    expect(screen.getByTestId('fetch-mode-selector')).toBeInTheDocument();
  });

  test('validates API URL field', async () => {
    render(<FetchConfigForm {...mockProps} />);
    
    const urlInput = screen.getByPlaceholderText('https://api.example.com/data');
    
    // Test invalid URL
    fireEvent.change(urlInput, { target: { value: 'invalid-url' } });
    fireEvent.blur(urlInput);
    
    await waitFor(() => {
      expect(screen.getByText(/请输入有效的URL/)).toBeInTheDocument();
    });
  });

  test('opens curl parser modal when import button is clicked', () => {
    render(<FetchConfigForm {...mockProps} />);
    
    const importButton = screen.getByText('从 Curl 命令导入配置');
    fireEvent.click(importButton);
    
    expect(screen.getByTestId('curl-parser-modal')).toBeInTheDocument();
  });

  test('handles curl parsing result correctly', async () => {
    render(<FetchConfigForm {...mockProps} />);
    
    // Open modal
    const importButton = screen.getByText('从 Curl 命令导入配置');
    fireEvent.click(importButton);
    
    // Trigger parse
    const parseButton = screen.getByText('解析');
    fireEvent.click(parseButton);
    
    await waitFor(() => {
      const urlInput = screen.getByPlaceholderText('https://api.example.com/data');
      expect(urlInput).toHaveValue('https://api.example.com/test');
    });
  });

  test('calls onConfigChange when form values change', async () => {
    render(<FetchConfigForm {...mockProps} />);
    
    const urlInput = screen.getByPlaceholderText('https://api.example.com/data');
    fireEvent.change(urlInput, { target: { value: 'https://api.test.com' } });
    
    await waitFor(() => {
      expect(mockProps.onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: 'https://api.test.com',
          enablePagination: false,
        })
      );
    });
  });

  test('disables buttons when form is invalid', () => {
    render(<FetchConfigForm {...mockProps} />);
    
    const smokeTestButton = screen.getByTestId('smoke-test-button');
    const startButton = screen.getByText('开始拉取');
    const saveButton = screen.getByText('保存配置');
    
    expect(smokeTestButton).toBeDisabled();
    expect(startButton).toBeDisabled();
    expect(saveButton).toBeDisabled();
  });

  test('enables buttons when form is valid', async () => {
    render(<FetchConfigForm {...mockProps} />);
    
    // Fill in required fields
    const urlInput = screen.getByPlaceholderText('https://api.example.com/data');
    fireEvent.change(urlInput, { target: { value: 'https://api.test.com' } });
    
    await waitFor(() => {
      const startButton = screen.getByText('开始拉取');
      expect(startButton).not.toBeDisabled();
    });
  });

  test('calls onStartFetch when start button is clicked', async () => {
    render(<FetchConfigForm {...mockProps} />);
    
    // Fill in required fields
    const urlInput = screen.getByPlaceholderText('https://api.example.com/data');
    fireEvent.change(urlInput, { target: { value: 'https://api.test.com' } });
    
    await waitFor(() => {
      const startButton = screen.getByText('开始拉取');
      expect(startButton).not.toBeDisabled();
      fireEvent.click(startButton);
    });
    
    expect(mockProps.onStartFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: 'https://api.test.com',
        enablePagination: false,
      })
    );
  });

  test('handles initial values correctly', () => {
    const initialValues: Partial<FetchConfig> = {
      apiUrl: 'https://initial.api.com',
      enablePagination: true,
      headers: { 'Authorization': 'Bearer test' },
    };
    
    render(<FetchConfigForm {...mockProps} initialValues={initialValues} />);
    
    const urlInput = screen.getByPlaceholderText('https://api.example.com/data');
    expect(urlInput).toHaveValue('https://initial.api.com');
  });
});