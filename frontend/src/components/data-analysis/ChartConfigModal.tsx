import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Switch,
  Button,
  Space,
  Divider,
  Card,
  Row,
  Col,
  Alert,
  Spin,
  message,
} from 'antd';
import { 
  BarChartOutlined, 
  LineChartOutlined, 
  PieChartOutlined,
  DotChartOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { ChartContainer, ChartData, ChartConfig } from './ChartContainer';
import api from '../../services/api';

const { Option } = Select;

interface Field {
  name: string;
  label: string;
  type: string;
}

interface ChartSuggestion {
  template: {
    id: string;
    name: string;
    description: string;
    chartType: 'line' | 'bar' | 'pie' | 'scatter';
  };
  xAxis: string;
  yAxis: string;
  xAxisLabel: string;
  yAxisLabel: string;
  aggregation?: string;
  title: string;
  description: string;
  suitability: number;
  estimatedDataPoints: number;
}

interface SavedChart {
  id: string;
  sessionId: string;
  name: string;
  chartType: 'line' | 'bar' | 'pie' | 'scatter';
  xAxis: string;
  yAxis: string;
  aggregation?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChartConfigModalProps {
  visible: boolean;
  sessionId: string;
  fields: Field[];
  filteredData?: any[];
  totalCount?: number;
  editingChart?: SavedChart | null;
  onClose: () => void;
  onGenerate: (config: ChartConfig) => void;
  onSave?: (config: ChartConfig & { name: string }) => void;
}

export const ChartConfigModal: React.FC<ChartConfigModalProps> = ({
  visible,
  sessionId,
  fields,
  filteredData = [],
  totalCount = 0,
  editingChart,
  onClose,
  onGenerate,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ChartSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<ChartData | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'suggestions'>('suggestions');

  // 图表类型选项
  const chartTypes = [
    { value: 'bar', label: '柱状图', icon: <BarChartOutlined /> },
    { value: 'line', label: '折线图', icon: <LineChartOutlined /> },
    { value: 'pie', label: '饼图', icon: <PieChartOutlined /> },
    { value: 'scatter', label: '散点图', icon: <DotChartOutlined /> },
  ];

  // 聚合方式选项
  const aggregationOptions = [
    { value: 'count', label: '计数', description: '统计记录数量' },
    { value: 'sum', label: '求和', description: '数值相加' },
    { value: 'avg', label: '平均值', description: '计算平均数' },
    { value: 'min', label: '最小值', description: '取最小值' },
    { value: 'max', label: '最大值', description: '取最大值' },
  ];

  // 获取数值字段
  const numericFields = fields.filter(field => 
    ['integer', 'number', 'decimal', 'float'].includes(field.type)
  );

  // 获取分类字段
  const categoricalFields = fields.filter(field => 
    ['string', 'text'].includes(field.type)
  );

  // 获取日期字段
  const dateFields = fields.filter(field => 
    ['date', 'datetime', 'timestamp'].includes(field.type)
  );

  useEffect(() => {
    if (visible && sessionId) {
      loadSuggestions();
    }
  }, [visible, sessionId]);



  const handleChartTypeChange = (chartType: string) => {
    if (chartType === 'pie') {
      form.setFieldValue('xAxisAggregation', 'group');
      form.setFieldValue('yAxisAggregation', 'count');
    } else if (chartType === 'bar' || chartType === 'line') {
      form.setFieldValue('xAxisAggregation', 'group');
      const yAxis = form.getFieldValue('yAxis');
      if (yAxis && numericFields.some(f => f.name === yAxis)) {
        form.setFieldValue('yAxisAggregation', 'sum');
      } else {
        form.setFieldValue('yAxisAggregation', 'count');
      }
    } else if (chartType === 'scatter') {
      form.setFieldValue('xAxisAggregation', 'none');
      form.setFieldValue('yAxisAggregation', 'none');
    }
    updatePreview();
  };

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const response = await api.get(`/data-analysis/chart/suggestions/${sessionId}`);
      if (response.data.success) {
        setSuggestions(response.data.suggestions);
      }
    } catch (error) {
      console.error('Failed to load chart suggestions:', error);
      message.error('获取图表建议失败');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // 实时预览
  const updatePreview = useCallback(async () => {
    try {
      const values = form.getFieldsValue();
      if (!values.chartType || !values.xAxis || !values.yAxis) {
        setPreviewData(null);
        return;
      }
      
      const config: ChartConfig = {
        sessionId,
        chartType: values.chartType,
        xAxis: values.xAxis,
        yAxis: values.yAxis,
        xAxisAggregation: values.xAxisAggregation,
        aggregation: values.yAxisAggregation,
        title: values.title,
        showLegend: values.showLegend,
        showDataLabels: values.showDataLabels,
      };

      const response = await api.post('/data-analysis/chart/preview', config);
      if (response.data.success) {
        setPreviewData(response.data.chartData);
      }
    } catch (error) {
      console.error('Failed to preview chart:', error);
      setPreviewData(null);
    }
  }, [sessionId, form]);

  // 编辑模式下回显数据
  useEffect(() => {
    if (visible && editingChart) {
      form.setFieldsValue({
        chartType: editingChart.chartType,
        xAxis: editingChart.xAxis,
        yAxis: editingChart.yAxis,
        xAxisAggregation: 'group',
        yAxisAggregation: editingChart.aggregation,
        title: editingChart.title || editingChart.name,
        showLegend: true,
        showDataLabels: editingChart.chartType === 'pie',
      });
      setActiveTab('manual');
      setTimeout(() => updatePreview(), 100);
    } else if (visible && !editingChart) {
      form.resetFields();
      setPreviewData(null);
    }
  }, [visible, editingChart, form, updatePreview]);

  const handleGenerateAndSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const config: ChartConfig = {
        sessionId,
        chartType: values.chartType,
        xAxis: values.xAxis,
        yAxis: values.yAxis,
        xAxisAggregation: values.xAxisAggregation,
        aggregation: values.yAxisAggregation,
        title: values.title,
        showLegend: values.showLegend,
        showDataLabels: values.showDataLabels,
      };

      // 如果有标题，先保存配置
      if (values.title && onSave) {
        const saveConfig = {
          ...config,
          name: values.title,
        };
        await onSave(saveConfig);
      }

      // 生成图表
      onGenerate(config);
      onClose();
    } catch (error) {
      console.error('Form validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = (suggestion: ChartSuggestion) => {
    form.setFieldsValue({
      chartType: suggestion.template.chartType,
      xAxis: suggestion.xAxis,
      yAxis: suggestion.yAxis,
      xAxisAggregation: 'group',
      yAxisAggregation: suggestion.aggregation,
      title: suggestion.title,
      showLegend: true,
      showDataLabels: suggestion.template.chartType === 'pie',
    });
    setActiveTab('manual');
    updatePreview();
    message.success('已应用图表建议');
  };

  const getSuitabilityColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <Modal
      title={editingChart ? `编辑图表 - ${editingChart.name}` : "图表配置"}
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button 
          key="generate" 
          type="primary" 
          onClick={handleGenerateAndSave}
          loading={loading}
        >
          {editingChart ? '更新图表' : '生成图表'}
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', gap: 16, height: 600 }}>
        {/* 左侧配置面板 */}
        <div style={{ width: '50%', overflowY: 'auto' }}>
          {/* 标签页切换 */}
          <div style={{ marginBottom: 16 }}>
            <Button.Group>
              <Button 
                type={activeTab === 'suggestions' ? 'primary' : 'default'}
                icon={<BulbOutlined />}
                onClick={() => setActiveTab('suggestions')}
              >
                智能建议
              </Button>
              <Button 
                type={activeTab === 'manual' ? 'primary' : 'default'}
                onClick={() => setActiveTab('manual')}
              >
                手动配置
              </Button>
            </Button.Group>
          </div>

          {activeTab === 'suggestions' ? (
            // 智能建议面板
            <div>
              <Alert
                message="智能图表建议"
                description={
                  <div>
                    <div>基于您的数据特征，为您推荐最适合的图表类型和配置</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                      当前筛选数据：{totalCount} 条记录
                    </div>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              {suggestionsLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin size="large" tip="正在分析数据特征..." />
                </div>
              ) : (
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                  {suggestions.map((suggestion, index) => (
                    <Card
                      key={index}
                      size="small"
                      style={{ marginBottom: 12 }}
                      hoverable
                      onClick={() => applySuggestion(suggestion)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                            {chartTypes.find(t => t.value === suggestion.template.chartType)?.icon}
                            <span style={{ marginLeft: 8, fontWeight: 'bold' }}>
                              {suggestion.title}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                            {suggestion.description}
                          </div>
                          <div style={{ fontSize: 11, color: '#999' }}>
                            X轴: {suggestion.xAxisLabel} | Y轴: {suggestion.yAxisLabel}
                            {suggestion.aggregation && ` | 聚合: ${suggestion.aggregation}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div 
                            style={{ 
                              color: getSuitabilityColor(suggestion.suitability),
                              fontWeight: 'bold',
                              fontSize: 14,
                            }}
                          >
                            {suggestion.suitability}%
                          </div>
                          <div style={{ fontSize: 10, color: '#999' }}>
                            适合度
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // 手动配置面板
            <div>
              <Alert
                message="字段选择建议"
                description={
                  <div>
                    <div>• <strong>柱状图/折线图</strong>：X轴选择分类或日期字段（分组），Y轴选择数值字段（求和/平均值）</div>
                    <div>• <strong>饼图</strong>：X轴选择分类字段（分组），Y轴通常使用"计数"聚合</div>
                    <div>• <strong>散点图</strong>：X轴和Y轴都选择数值字段（原始值）</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                      📊 将基于表格中筛选的 <strong>{totalCount}</strong> 条数据生成图表
                    </div>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16, fontSize: 12 }}
              />
              
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  showLegend: true,
                  showDataLabels: false,
                }}
                onValuesChange={updatePreview}
              >
              <Form.Item
                name="chartType"
                label="图表类型"
                rules={[{ required: true, message: '请选择图表类型' }]}
              >
                <Select placeholder="选择图表类型" onChange={handleChartTypeChange}>
                  {chartTypes.map(type => (
                    <Option key={type.value} value={type.value}>
                      <Space>
                        {type.icon}
                        {type.label}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item
                    name="xAxis"
                    label="X轴字段"
                    rules={[{ required: true, message: '请选择X轴字段' }]}
                    tooltip="X轴通常用于分类或时间维度，如产品类别、日期等"
                  >
                    <Select placeholder="选择X轴字段（通常为分类或时间字段）">
                      {categoricalFields.length > 0 && (
                        <Select.OptGroup label="分类字段（推荐）">
                          {categoricalFields.map(field => (
                            <Option key={field.name} value={field.name}>
                              {field.label} ({field.type})
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}
                      {dateFields.length > 0 && (
                        <Select.OptGroup label="日期字段（推荐）">
                          {dateFields.map(field => (
                            <Option key={field.name} value={field.name}>
                              {field.label} ({field.type})
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}
                      {numericFields.length > 0 && (
                        <Select.OptGroup label="数值字段">
                          {numericFields.map(field => (
                            <Option key={field.name} value={field.name}>
                              {field.label} ({field.type})
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="xAxisAggregation"
                    label="X轴计算方式"
                    tooltip="选择如何处理X轴数据：原始值、分组等"
                  >
                    <Select placeholder="计算方式" allowClear>
                      <Option value="none" title="使用原始值，不进行聚合">原始值</Option>
                      <Option value="group" title="按值分组">分组</Option>
                      <Option value="date_group" title="按日期分组（年、月、日）">日期分组</Option>
                      <Option value="range" title="按数值范围分组">范围分组</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item
                    name="yAxis"
                    label="Y轴字段"
                    rules={[{ required: true, message: '请选择Y轴字段' }]}
                    tooltip="Y轴通常用于数值度量，如销售额、数量等"
                  >
                    <Select placeholder="选择Y轴字段（通常为数值字段）">
                      {numericFields.length > 0 && (
                        <Select.OptGroup label="数值字段（推荐）">
                          {numericFields.map(field => (
                            <Option key={field.name} value={field.name}>
                              {field.label} ({field.type})
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}
                      {categoricalFields.length > 0 && (
                        <Select.OptGroup label="分类字段">
                          {categoricalFields.map(field => (
                            <Option key={field.name} value={field.name}>
                              {field.label} ({field.type})
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}
                      {dateFields.length > 0 && (
                        <Select.OptGroup label="日期字段">
                          {dateFields.map(field => (
                            <Option key={field.name} value={field.name}>
                              {field.label} ({field.type})
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="yAxisAggregation"
                    label="Y轴计算方式"
                    tooltip="选择如何计算Y轴数值：计数统计记录数，求和计算总和，平均值计算均值等"
                  >
                    <Select placeholder="计算方式" allowClear>
                      {aggregationOptions.map(option => (
                        <Option key={option.value} value={option.value} title={option.description}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="title"
                label="图表标题"
                tooltip="既作为图表显示标题，也作为配置保存名称"
              >
                <Input placeholder="输入图表标题（同时用作配置名称）" />
              </Form.Item>

              <Divider />

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="showLegend"
                    label="显示图例"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="showDataLabels"
                    label="显示数据标签"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            </div>
          )}
        </div>

        {/* 右侧预览面板 */}
        <div style={{ width: '50%', borderLeft: '1px solid #f0f0f0', paddingLeft: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <h4>实时预览</h4>
          </div>
          <ChartContainer
            chartData={previewData || undefined}
            loading={false}
            height={500}
            showToolbar={false}
          />
        </div>
      </div>
    </Modal>
  );
};

export default ChartConfigModal;