import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  Space,
  Divider,
  Typography,
  Row,
  Col,
  message,
  Alert,
  Tooltip,
} from 'antd';
import { 
  ImportOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import SmokeTestButton from './SmokeTestButton';
import CurlParserModal from './CurlParserModal';
import FetchModeSelector from './FetchModeSelector';
import { FetchConfig, SmokeTestResponse } from '../../types';

const { Title, Text } = Typography;

interface FetchConfigFormProps {
  onConfigChange?: (config: FetchConfig) => void;
  onSmokeTestComplete?: (result: SmokeTestResponse) => void;
  onStartFetch?: (config: FetchConfig) => void;
  onSaveConfig?: (config: FetchConfig) => void;
  initialValues?: Partial<FetchConfig>;
  loading?: boolean;
  disabled?: boolean;
}

const FetchConfigForm: React.FC<FetchConfigFormProps> = ({
  onConfigChange,
  onSmokeTestComplete,
  onStartFetch,
  onSaveConfig,
  initialValues,
  loading = false,
  disabled = false,
}) => {
  const [form] = Form.useForm();
  const [curlModalVisible, setCurlModalVisible] = useState(false);
  const [enablePagination, setEnablePagination] = useState<boolean>(false);
  const [pageField, setPageField] = useState<string>('');
  const [totalField, setTotalField] = useState<string>('');
  const [suggestedPageFields, setSuggestedPageFields] = useState<string[]>([]);
  const [suggestedTotalFields, setSuggestedTotalFields] = useState<string[]>([]);
  const [formValid, setFormValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // 验证表单
  const validateForm = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      const errors: string[] = [];

      // 验证API URL
      if (!values.apiUrl) {
        errors.push('API URL 是必填项');
      } else {
        try {
          new URL(values.apiUrl);
        } catch {
          errors.push('请输入有效的 API URL');
        }
      }

      // 验证分页参数
      if (values.enablePagination) {
        if (!values.pageField) {
          errors.push('启用拉取全部时必须选择分页字段');
        }
        // 拉取全部模式不需要验证pageSize，系统会自动处理
      }

      // 验证请求头
      if (values.headers && Array.isArray(values.headers)) {
        const duplicateKeys = new Set();
        values.headers.forEach((header: any, index: number) => {
          if (header?.key && header?.value) {
            if (duplicateKeys.has(header.key)) {
              errors.push(`请求头 "${header.key}" 重复`);
            }
            duplicateKeys.add(header.key);
          } else if (header?.key && !header?.value) {
            // 允许空值，不报错
          } else if (!header?.key && header?.value) {
            errors.push(`第 ${index + 1} 个请求头缺少名称`);
          }
        });
      }

      // 验证查询参数
      if (values.queryParams && Array.isArray(values.queryParams)) {
        const duplicateKeys = new Set();
        values.queryParams.forEach((param: any, index: number) => {
          if (param?.key && param?.value) {
            if (duplicateKeys.has(param.key)) {
              errors.push(`查询参数 "${param.key}" 重复`);
            }
            duplicateKeys.add(param.key);
          } else if (param?.key && !param?.value) {
            // 允许空值，不报错
          } else if (!param?.key && param?.value) {
            errors.push(`第 ${index + 1} 个查询参数缺少名称`);
          }
        });
      }

      setValidationErrors(errors);
      setFormValid(errors.length === 0);
      return errors.length === 0;
    } catch {
      setFormValid(false);
      return false;
    }
  };

  // 监听表单值变化
  const handleValuesChange = async (changedValues: any, allValues: any) => {
    // 更新分页设置
    if (changedValues.enablePagination !== undefined) {
      setEnablePagination(changedValues.enablePagination);
    }
    if (changedValues.pageField) {
      setPageField(changedValues.pageField);
    }
    if (changedValues.totalField) {
      setTotalField(changedValues.totalField);
    }

    const config: FetchConfig = {
      apiUrl: allValues.apiUrl || '',
      headers: {},
      enablePagination: allValues.enablePagination || false,
      pageField: allValues.pageField,
      totalField: allValues.totalField,
      pageSize: allValues.pageSize || 20,
    };

    // 处理请求头
    if (allValues.headers && Array.isArray(allValues.headers)) {
      allValues.headers.forEach((header: any) => {
        if (header?.key) {
          config.headers[header.key] = header.value || '';
        }
      });
    }

    // 处理查询参数
    const queryParams: Record<string, string> = {};
    if (allValues.queryParams && Array.isArray(allValues.queryParams)) {
      allValues.queryParams.forEach((param: any) => {
        if (param?.key) {
          queryParams[param.key] = param.value || '';
        }
      });
    }
    config.queryParams = queryParams;

    onConfigChange?.(config);
    
    // 延迟验证以避免频繁验证
    setTimeout(validateForm, 300);
  };

  // 初始化时验证表单和设置初始值
  useEffect(() => {
    if (initialValues) {
      // 处理初始值中的请求头
      const headersArray = initialValues.headers 
        ? Object.entries(initialValues.headers).map(([key, value]) => ({ key, value }))
        : [{ key: '', value: '' }];
      
      // 处理初始值中的查询参数
      const queryParamsArray = initialValues.queryParams 
        ? Object.entries(initialValues.queryParams).map(([key, value]) => ({ key, value }))
        : [{ key: '', value: '' }];
      
      form.setFieldsValue({
        ...initialValues,
        headers: headersArray,
        queryParams: queryParamsArray,
      });
      
      if (initialValues.enablePagination !== undefined) {
        setEnablePagination(initialValues.enablePagination);
      }
      if (initialValues.pageField) {
        setPageField(initialValues.pageField);
      }
      if (initialValues.totalField) {
        setTotalField(initialValues.totalField);
      }
    }
    
    validateForm();
  }, [initialValues]);

  // 处理冒烟测试完成
  const handleSmokeTestComplete = (result: SmokeTestResponse) => {
    // 如果测试成功且有建议的分页字段，自动设置
    if (result.success && result.suggestedPageFields && result.suggestedPageFields.length > 0) {
      setSuggestedPageFields(result.suggestedPageFields);
      
      // 如果还没有选择分页字段，自动选择第一个建议字段
      if (!pageField && result.suggestedPageFields.length > 0) {
        const suggestedField = result.suggestedPageFields[0];
        setPageField(suggestedField);
        form.setFieldValue('pageField', suggestedField);
        message.info(`检测到分页字段 "${suggestedField}"，已自动选择`);
      }
    }
    
    // 调用原始回调
    onSmokeTestComplete?.(result);
  };

  // 处理curl解析结果
  const handleCurlParsed = (config: any) => {
    try {
      // 转换请求头格式 - 保留所有值，包括空值
      const headersArray = Object.entries(config.headers || {}).map(([key, value]) => ({
        key,
        value: value || '', // 确保空值显示为空字符串而不是 undefined
      }));

      // 确保至少有一个空的请求头输入框
      if (headersArray.length === 0) {
        headersArray.push({ key: '', value: '' });
      }

      // 转换查询参数格式 - 保留所有值，包括空值
      const queryParamsArray = Object.entries(config.queryParams || {}).map(([key, value]) => ({
        key,
        value: value || '', // 确保空值显示为空字符串而不是 undefined
      }));

      // 确保至少有一个空的查询参数输入框
      if (queryParamsArray.length === 0) {
        queryParamsArray.push({ key: '', value: '' });
      }

      // 填充表单
      const formValues: any = {
        apiUrl: config.apiUrl,
        headers: headersArray,
        queryParams: queryParamsArray,
      };

      // 如果有查询参数，尝试识别分页参数
      if (config.queryParams) {
        const { page, size, limit } = config.queryParams;
        if (page) {
          const pageNum = parseInt(page);
          if (!isNaN(pageNum) && pageNum > 0) {
            formValues.startPage = pageNum;
          }
        }
        if (size || limit) {
          const sizeNum = parseInt(size || limit);
          if (!isNaN(sizeNum) && sizeNum > 0) {
            formValues.pageSize = sizeNum;
          }
        }
      }

      // 先重置表单，然后设置新值
      form.resetFields();
      setTimeout(() => {
        form.setFieldsValue(formValues);
        // 触发表单验证
        setTimeout(validateForm, 100);
      }, 50);
      
      message.success('curl命令解析成功，已自动填充配置！');
    } catch (error) {
      console.error('处理curl解析结果时出错:', error);
      message.error('处理解析结果时出错，请检查配置');
    }
  };

  // 获取当前配置用于冒烟测试
  const getCurrentConfig = () => {
    const values = form.getFieldsValue();
    const headers: Record<string, string> = {};
    const queryParams: Record<string, string> = {};
    
    if (values.headers && Array.isArray(values.headers)) {
      values.headers.forEach((header: any) => {
        if (header?.key) {
          headers[header.key] = header.value || '';
        }
      });
    }

    if (values.queryParams && Array.isArray(values.queryParams)) {
      values.queryParams.forEach((param: any) => {
        if (param?.key) {
          queryParams[param.key] = param.value || '';
        }
      });
    }

    return {
      apiUrl: values.apiUrl || '',
      headers,
      queryParams,
      pageSize: values.pageSize || 20,
    };
  };

  return (
    <Card title="数据拉取配置" size="small">
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          enablePagination: false,
          pageSize: 20,
          headers: [{ key: '', value: '' }],
          queryParams: [{ key: '', value: '' }],
          ...initialValues,
        }}
        onValuesChange={handleValuesChange}
      >
        {/* API 配置标题和导入按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={5} style={{ margin: 0 }}>API 配置</Title>
          <Button
            type="default"
            icon={<ImportOutlined />}
            onClick={() => setCurlModalVisible(true)}
            disabled={disabled || loading}
            size="small"
          >
            导入
          </Button>
        </div>
        
        <Form.Item
          label="API URL"
          name="apiUrl"
          rules={[
            { required: true, message: '请输入API URL' },
            { type: 'url', message: '请输入有效的URL' },
          ]}
        >
          <Input placeholder="https://api.example.com/data" />
        </Form.Item>

        {/* 请求头配置 */}
        <Form.Item 
          label={
            <span>
              请求头
              <Tooltip title="设置API请求需要的HTTP头部信息，如认证token、内容类型等">
                <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
              </Tooltip>
            </span>
          }
        >
          <Form.List name="headers">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle">
                    <Col span={10}>
                      <Form.Item
                        {...restField}
                        name={[name, 'key']}
                        style={{ marginBottom: 8 }}
                      >
                        <Input placeholder="请求头名称 (如: Authorization)" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        style={{ marginBottom: 8 }}
                      >
                        <Input placeholder="请求头值" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                        danger
                        size="small"
                      />
                    </Col>
                  </Row>
                ))}
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="dashed"
                    onClick={() => add({ key: '', value: '' })}
                    icon={<PlusOutlined />}
                    style={{ width: '100%' }}
                  >
                    添加请求头
                  </Button>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    <Text type="secondary">
                      常用请求头：Authorization (认证)、Content-Type (内容类型)、X-API-Key (API密钥)
                    </Text>
                  </div>
                </Space>
              </>
            )}
          </Form.List>
        </Form.Item>

        {/* 查询参数配置 */}
        <Form.Item 
          label={
            <span>
              查询参数
              <Tooltip title="设置URL查询参数，如分页参数、筛选条件等">
                <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
              </Tooltip>
            </span>
          }
        >
          <Form.List name="queryParams">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle">
                    <Col span={10}>
                      <Form.Item
                        {...restField}
                        name={[name, 'key']}
                        style={{ marginBottom: 8 }}
                      >
                        <Input placeholder="参数名称 (如: page)" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        style={{ marginBottom: 8 }}
                      >
                        <Input placeholder="参数值" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                        danger
                        size="small"
                      />
                    </Col>
                  </Row>
                ))}
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="dashed"
                    onClick={() => add({ key: '', value: '' })}
                    icon={<PlusOutlined />}
                    style={{ width: '100%' }}
                  >
                    添加查询参数
                  </Button>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    <Text type="secondary">
                      常用参数：page (页码)、size/limit (每页数量)、sort (排序)
                    </Text>
                  </div>
                </Space>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Divider />

        {/* 拉取模式 */}
        <Title level={5}>
          拉取模式
          <Tooltip title="选择数据拉取方式：分页拉取可以精确控制拉取范围，全部拉取会自动获取所有可用数据">
            <InfoCircleOutlined style={{ marginLeft: 8, fontSize: 14, color: '#999' }} />
          </Tooltip>
        </Title>
        
        <Form.Item name="enablePagination">
          <FetchModeSelector 
            value={enablePagination}
            onChange={setEnablePagination}
            pageField={pageField}
            onPageFieldChange={setPageField}
            totalField={totalField}
            onTotalFieldChange={setTotalField}
            suggestedPageFields={suggestedPageFields}
            suggestedTotalFields={suggestedTotalFields}
            disabled={disabled || loading}
          />
        </Form.Item>

        {/* 验证错误显示 */}
        {validationErrors.length > 0 && (
          <Alert
            type="error"
            message="配置验证失败"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            }
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        {/* 配置状态指示 */}
        {formValid && (
          <Alert
            type="success"
            message="配置验证通过"
            description="所有配置项都已正确填写，可以进行测试或开始拉取"
            style={{ marginBottom: 16 }}
            showIcon
            icon={<CheckCircleOutlined />}
          />
        )}

        <Divider />

        {/* 操作按钮 */}
        <Row gutter={16}>
          <Col span={8}>
            <SmokeTestButton
              {...getCurrentConfig()}
              onTestComplete={handleSmokeTestComplete}
              disabled={!formValid || loading}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={8}>
            <Tooltip title={!formValid ? '请先完成配置验证' : ''}>
              <Button 
                disabled={!formValid || loading}
                onClick={() => {
                  const values = form.getFieldsValue();
                  const config: FetchConfig = {
                    apiUrl: values.apiUrl,
                    headers: {},
                    queryParams: {},
                    enablePagination: values.enablePagination,
                    pageField: values.pageField,
                    totalField: values.totalField,
                    pageSize: values.pageSize,
                  };
                  
                  // 处理请求头
                  if (values.headers && Array.isArray(values.headers)) {
                    values.headers.forEach((header: any) => {
                      if (header?.key && header?.value) {
                        config.headers[header.key] = header.value;
                      }
                    });
                  }

                  // 处理查询参数
                  if (values.queryParams && Array.isArray(values.queryParams)) {
                    values.queryParams.forEach((param: any) => {
                      if (param?.key && param?.value) {
                        config.queryParams![param.key] = param.value;
                      }
                    });
                  }
                  
                  onSaveConfig?.(config);
                  message.success('配置已保存');
                }}
                style={{ width: '100%' }}
              >
                保存配置
              </Button>
            </Tooltip>
          </Col>
          <Col span={8}>
            <Tooltip title={!formValid ? '请先完成配置验证' : ''}>
              <Button 
                type="primary"
                disabled={!formValid || loading}
                loading={loading}
                onClick={() => {
                  const values = form.getFieldsValue();
                  const config: FetchConfig = {
                    apiUrl: values.apiUrl,
                    headers: {},
                    queryParams: {},
                    enablePagination: values.enablePagination,
                    pageField: values.pageField,
                    totalField: values.totalField,
                    pageSize: values.pageSize,
                  };
                  
                  // 处理请求头
                  if (values.headers && Array.isArray(values.headers)) {
                    values.headers.forEach((header: any) => {
                      if (header?.key && header?.value) {
                        config.headers[header.key] = header.value;
                      }
                    });
                  }

                  // 处理查询参数
                  if (values.queryParams && Array.isArray(values.queryParams)) {
                    values.queryParams.forEach((param: any) => {
                      if (param?.key && param?.value) {
                        config.queryParams![param.key] = param.value;
                      }
                    });
                  }
                  
                  onStartFetch?.(config);
                }}
                style={{ width: '100%' }}
              >
                开始拉取
              </Button>
            </Tooltip>
          </Col>
        </Row>
      </Form>

      {/* Curl解析弹窗 */}
      <CurlParserModal
        visible={curlModalVisible}
        onClose={() => setCurlModalVisible(false)}
        onParsed={handleCurlParsed}
      />
    </Card>
  );
};

export default FetchConfigForm;