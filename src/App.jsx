import React, { useContext, useEffect, useRef, useState } from 'react';
import { Button, Form, Input, Popconfirm, Table, Modal, Typography } from 'antd';
import axios from 'axios';

const { Title } = Typography;
const EditableContext = React.createContext(null);

const EditableRow = ({ index, ...props }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};

const EditableCell = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);
  const form = useContext(EditableContext);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const toggleEdit = () => {
    setEditing(!editing);
    form.setFieldsValue({
      [dataIndex]: record[dataIndex],
    });
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      toggleEdit();
      handleSave({
        ...record,
        ...values,
      });
    } catch (errInfo) {
      console.log('Save failed:', errInfo);
    }
  };

  let childNode = children;

  if (editable) {
    childNode = editing ? (
      <Form.Item
        style={{ margin: 0 }}
        name={dataIndex}
        rules={[{ required: true, message: `${title} es obligatorio.` }]}
      >
        <Input ref={inputRef} onPressEnter={save} onBlur={save} />
      </Form.Item>
    ) : (
      <div className="editable-cell-value-wrap" style={{ paddingRight: 24 }} onClick={toggleEdit}>
        {children}
      </div>
    );
  }

  return <td {...restProps}>{childNode}</td>;
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [loginData, setLoginData] = useState({ username: '', password: '' });

  const handleLogin = () => {
    if (loginData.username === 'admin' && loginData.password === 'admin') {
      setIsAuthenticated(true);
      setUsername(loginData.username); // Guardamos el nombre del usuario
    } else {
      alert('Credenciales incorrectas. Intenta con admin/admin');
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const [suggestEnabled, setSuggestEnabled] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newData, setNewData] = useState({ activo: '', riesgo: '', impacto: '', tratamiento: '' });
  const [dataSource, setDataSource] = useState([]);
  const [count, setCount] = useState(2);
  const [isRecommending, setIsRecommending] = useState(false);

  const showModal = () => setIsModalVisible(true);
  const handleCancel = () => setIsModalVisible(false);

  const handleOk = () => {
    setIsLoading(true);
    axios.post('/analizar-riesgos', { activo: newData.activo })
      .then(response => {
        const { activo, riesgos, impactos } = response.data;
        addNewRows(activo, riesgos, impactos);
        setIsModalVisible(false);
        setIsLoading(false);
        setSuggestEnabled(true);
      })
      .catch(error => {
        console.error('Error al obtener riesgos e impactos:', error);
        setIsLoading(false);
      });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewData(prev => ({ ...prev, [name]: value }));
  };

  const addNewRows = (activo, riesgos, impactos) => {
    const newRows = riesgos.map((riesgo, index) => ({
      key: `${count + index}`,
      activo,
      riesgo,
      impacto: impactos[index],
      tratamiento: '-'
    }));
    setDataSource(prev => [...prev, ...newRows]);
    setCount(prev => prev + riesgos.length);
    setNewData({ activo: '', riesgo: '', impacto: '', tratamiento: '' });
  };

  const handleRecommendTreatment = () => {
    setIsRecommending(true);
    const promises = dataSource.map((row, index) => {
      return axios.post('/sugerir-tratamiento', {
        activo: row.activo,
        riesgo: row.riesgo,
        impacto: row.impacto
      }).then(response => {
        const { tratamiento } = response.data;
        const updatedDataSource = [...dataSource];
        updatedDataSource[index] = { ...updatedDataSource[index], tratamiento };
        return updatedDataSource[index];
      });
    });

    Promise.all(promises)
      .then(updatedRows => {
        setDataSource(updatedRows);
        setIsRecommending(false);
      })
      .catch(error => {
        console.error('Error al obtener tratamientos:', error);
        setIsRecommending(false);
      });
  };

  const handleDelete = (key) => {
    const newData = dataSource.filter(item => item.key !== key);
    setDataSource(newData);
  };

  const handleSave = (row) => {
    const newData = [...dataSource];
    const index = newData.findIndex(item => row.key === item.key);
    const item = newData[index];
    newData.splice(index, 1, { ...item, ...row });
    setDataSource(newData);
  };

  const defaultColumns = [
    { title: 'Activo', dataIndex: 'activo', width: '10%', editable: true },
    { title: 'Riesgo', dataIndex: 'riesgo', width: '15%', editable: true },
    { title: 'Impacto', dataIndex: 'impacto', width: '45%', editable: true },
    { title: 'Tratamiento', dataIndex: 'tratamiento', width: '30%', editable: true },
    {
      title: 'Operación',
      dataIndex: 'operation',
      render: (_, record) =>
        dataSource.length >= 1 ? (
          <Popconfirm title="¿Seguro que quieres eliminar?" onConfirm={() => handleDelete(record.key)}>
            <a>Eliminar</a>
          </Popconfirm>
        ) : null,
    },
  ];

  const components = {
    body: {
      row: EditableRow,
      cell: EditableCell,
    },
  };

  const columns = defaultColumns.map(col => {
    if (!col.editable) return col;
    return {
      ...col,
      onCell: (record) => ({
        record,
        editable: col.editable,
        dataIndex: col.dataIndex,
        title: col.title,
        handleSave,
      }),
    };
  });

  // Vista de login si el usuario no está autenticado
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 300, margin: '100px auto', textAlign: 'center' }}>
        <Title level={3}>Inicio de sesión</Title>
        <Form layout="vertical">
          <Form.Item label="Usuario">
            <Input name="username" value={loginData.username} onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} />
          </Form.Item>
          <Form.Item label="Contraseña">
            <Input.Password name="password" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
          </Form.Item>
          <Button type="primary" onClick={handleLogin}>Entrar</Button>
        </Form>
      </div>
    );
  }

  // Vista principal si el usuario ya está autenticado
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4}>Bienvenido, {username}</Title>
        <Button danger onClick={() => { setIsAuthenticated(false); setLoginData({ username: '', password: '' }); }}>Cerrar sesión</Button>
      </div>
      <Button onClick={showModal} type="primary" style={{ marginBottom: 16 }}>
        + Agregar activo
      </Button>
      <Button onClick={handleRecommendTreatment} type="primary" loading={isRecommending} disabled={!suggestEnabled} style={{ marginBottom: 16, marginLeft: 8 }}>
        Recomendar tratamientos
      </Button>
      <Modal
        title="Agregar nuevo activo"
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        okText="Agregar"
        cancelText="Cancelar"
        confirmLoading={isLoading}
      >
        <Form layout="vertical">
          <Form.Item label="Activo">
            <Input name="activo" value={newData.activo} onChange={handleChange} />
          </Form.Item>
        </Form>
      </Modal>
      <Table
        components={components}
        rowClassName={() => 'editable-row'}
        bordered
        dataSource={dataSource}
        columns={columns}
      />
    </div>
  );
};

export default App;
