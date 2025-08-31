import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Progress, message, Space, Typography, Divider, Badge } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  BulbOutlined,
  SaveOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { FieldInfo, FieldAnnotation } from '../../types';
import { FieldList } from './FieldList';
import api from '../../services/api';

const { Title, Text } = Typography;

interface FieldAnnotationFormProps {
  sessionId: string;
  onComplete: () => void;
  onBack?: () => void;
}

interface AnnotationProgress {
  totalFields: number;
  annotatedFields: number;
  progress: number;
  missingAnnotations: string[];
}

export const FieldAnnotationForm: React.FC<FieldAnnotationFormProps> = ({
  sessionId,
  onComplete,
  onBack
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [progress, setProgress] = useState<AnnotationProgress>({
    totalFields: 0,
    annotatedFields: 0,
    progress: 0,
    missingAnnotations: []
  });

  // 加载字段信息
  useEffect(() => {
    loadFields();
    loadProgress();
  }, [sessionId]);

  const loadFields = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/field-annotation/fields/${sessionId}`);
      const fieldsData = response.data.fields || [];
      
      setFields(fieldsData);
      
      // 初始化表单值
      const initialValues: Record<string, any> = {};
      fieldsData.forEach((field: FieldInfo & { annotation?: FieldAnnotation }) => {
        if (field.annotation) {
          initialValues[`${field.name}_label`] = field.annotation.label;
          initialValues[`${field.name}_description`] = field.annotation.description;
        } else {
          initialValues[`${field.name}_label`] = field.suggestedLabel;
        }
      });
      
      form.setFieldsValue(initialValues);
    } catch (error) {
      console.error('加载字段信息失败:', error);
      message.error('加载字段信息失败');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const response = await api.get(`/field-annotation/progress/${sessionId}`);
      setProgress(response.data);
    } catch (error) {
      console.error('加载进度信息失败:', error);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      // 构建标注数据
      const annotations: FieldAnnotation[] = fields.map(field => ({
        fieldName: field.name,
        label: values[`${field.name}_label`] || field.suggestedLabel,
        description: values[`${field.name}_description`] || undefined
      }));

      // 批量保存标注
      await api.post(`/field-annotation/batch-save`, {
        sessionId,
        annotations
      });

      message.success('字段标注保存成功！');
      
      // 重新加载进度
      await loadProgress();
      
    } catch (error) {
      console.error('保存标注失败:', error);
      message.error('保存标注失败');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    try {
      // 先保存当前标注
      await handleSave();
      
      // 验证标注完整性
      const response = await api.get(`/field-annotation/validate/${sessionId}`);
      const validation = response.data;
      
      if (!validation.isComplete) {
        message.warning(`还有 ${validation.missingFields.length} 个字段未标注`);
        return;
      }
      
      if (validation.errors.length > 0) {
        message.error(`标注验证失败: ${validation.errors.join(', ')}`);
        return;
      }
      
      message.success('字段标注完成！');
      onComplete();
      
    } catch (error) {
      console.error('完成标注失败:', error);
      message.error('完成标注失败');
    }
  };

  const handleAutoSuggest = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/field-annotation/suggestions/${sessionId}`);
      const suggestions = response.data.suggestions || [];
      
      // 应用建议到表单
      const newValues: Record<string, any> = {};
      suggestions.forEach((suggestion: any) => {
        newValues[`${suggestion.fieldName}_label`] = suggestion.suggestedLabel;
      });
      
      form.setFieldsValue(newValues);
      message.success('已应用智能标注建议');
      
    } catch (error) {
      console.error('获取标注建议失败:', error);
      message.error('获取标注建议失败');
    } finally {
      setLoading(false);
    }
  };

  const getProgressStatus = () => {
    if (progress.progress === 100) return 'success';
    if (progress.progress > 0) return 'active';
    return 'normal';
  };

  const getProgressColor = () => {
    if (progress.progress === 100) return '#52c41a';
    if (progress.progress >= 50) return '#1890ff';
    return '#faad14';
  };

  return (
    <div className="field-annotation-form">
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div className="annotation-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Badge 
              count="2" 
              style={{ 
                backgroundColor: '#52c41a',
                marginRight: 12,
                fontSize: 12,
                minWidth: 20,
                height: 20,
                lineHeight: '20px'
              }}
            />
            <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
              字段标注
            </Title>
          </div>
          <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
            为数据字段添加有意义的标注，以便更好地理解和分析数据。
            完成标注后可以进入数据分析步骤。
          </Text>
        </div>

        {/* 进度指示器 */}
        <Card 
          size="small" 
          style={{ 
            marginBottom: 24,
            background: 'linear-gradient(135deg, #f6ffed 0%, #f0f9ff 100%)',
            border: '1px solid #b7eb8f'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 15 }}>标注进度</Text>
              <Badge 
                count={`${progress.annotatedFields}/${progress.totalFields}`}
                style={{ 
                  backgroundColor: progress.progress === 100 ? '#52c41a' : '#1890ff',
                  marginLeft: 8
                }}
              />
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {progress.progress === 100 ? '已完成' : '进行中'}
            </Text>
          </div>
          
          <Progress
            percent={progress.progress}
            status={getProgressStatus()}
            strokeColor={{
              '0%': '#52c41a',
              '100%': '#1890ff',
            }}
            showInfo={true}
            strokeWidth={8}
            format={(percent) => (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 500 }}>
                {percent === 100 ? (
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                ) : (
                  <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 4 }} />
                )}
                {percent}%
              </span>
            )}
          />
          
          {progress.missingAnnotations.length > 0 && (
            <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fff7e6', borderRadius: 4 }}>
              <Text type="warning" style={{ fontSize: 12 }}>
                <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                待标注字段: {progress.missingAnnotations.slice(0, 5).join(', ')}
                {progress.missingAnnotations.length > 5 && ` 等${progress.missingAnnotations.length}个`}
              </Text>
            </div>
          )}
        </Card>

        {/* 操作按钮 */}
        <div className="action-buttons" style={{ marginBottom: 24 }}>
          <Space size="middle">
            <Button 
              type="dashed" 
              icon={<BulbOutlined />}
              onClick={handleAutoSuggest}
              loading={loading}
              style={{ borderColor: '#faad14', color: '#faad14' }}
            >
              智能标注建议
            </Button>
            <Button 
              type="primary" 
              ghost 
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              保存标注
            </Button>
          </Space>
        </div>

        <Divider style={{ margin: '24px 0' }} />

        {/* 字段列表 */}
        <Form form={form} layout="vertical">
          <FieldList 
            fields={fields}
            loading={loading}
            form={form}
          />
        </Form>

        {/* 底部操作按钮 */}
        <div className="form-actions" style={{ 
          marginTop: 32, 
          padding: '16px 0',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {onBack && (
              <Button onClick={onBack} size="large">
                上一步
              </Button>
            )}
          </div>
          <Button 
            type="primary" 
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={handleComplete}
            loading={saving}
            disabled={progress.progress < 100}
            style={{
              background: progress.progress === 100 
                ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)'
                : undefined,
              border: 'none',
              boxShadow: progress.progress === 100 
                ? '0 2px 8px rgba(82, 196, 26, 0.3)'
                : undefined
            }}
          >
            完成标注，进入数据分析
          </Button>
        </div>
      </Card>
    </div>
  );
};