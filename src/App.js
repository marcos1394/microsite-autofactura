// src/App.js (Proyecto: microsite-autofactura - Versión Mejorada)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
// En src/index.js
import './index.css'; // o la ruta a tu archivo CSS principal
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from 'react-modal';
import { Search, Ticket, Mail, CheckCircle, Calendar, DollarSign, X, Loader2 } from 'lucide-react';

Modal.setAppElement('#root'); // Para accesibilidad del modal

function App() {
  // --- Estado para Branding (con defaults) ---
  const [branding, setBranding] = useState({
    portalName: 'Portal de Facturación',
    logoUrl: null,
    primaryColor: '#3B82F6',    // Azul default
    secondaryColor: '#F9FAFB', // Gris claro default
  });
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [brandingError, setBrandingError] = useState(null);

  // --- Estado para Lógica de Tickets ---
  const [ticketData, setTicketData] = useState({ ticketNumber: '', amount: '', date: '' });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false); // Estado de carga general
  const [searchPerformed, setSearchPerformed] = useState(false); // Para mostrar mensaje cuando no se encuentra ticket

  // --- Función para obtener el Subdominio ---
  const getSubdomain = () => {
    const host = window.location.hostname;
    const parts = host.split('.');
    // Asume formato 'cliente.nextmanager.com.mx' o 'localhost'
    if (parts.length >= 3 && parts[0] !== 'www' && !host.includes('localhost')) {
      return parts[0]; // Devuelve solo el prefijo del subdominio, ej: 'refa'
    }
    // Para pruebas locales: http://localhost:3000?subdomain=testcliente
    const queryParams = new URLSearchParams(window.location.search);
    return queryParams.get('subdomain');
  };

  // --- Cargar Branding al Montar ---
  useEffect(() => {
    const subdomain = getSubdomain(); // ej: 'refa'
    console.log("Microsite - Subdominio Detectado (prefijo):", subdomain);

    if (!subdomain) {
      setBrandingError("Acceso inválido. Se requiere un subdominio de restaurante.");
      setBrandingLoading(false);
      return;
    }

    setBrandingLoading(true);
    setBrandingError(null);
    const apiUrl = process.env.REACT_APP_API_URL; // URL base del backend (API Gateway)
    if (!apiUrl) {
      console.error("REACT_APP_API_URL no está definido!");
      setBrandingError("Error de configuración del cliente (API URL).");
      setBrandingLoading(false);
      return;
    }

    // Endpoint para obtener branding.
    axios.get(`${apiUrl}/api/portal/brand?domain=${subdomain}.nextmanager.com.mx`)
      .then((res) => {
        if (res.data.success && res.data.data) {
          console.log("Branding data received:", res.data.data);
          setBranding(prev => ({
            ...prev,
            portalName: res.data.data.portalName || prev.portalName,
            logoUrl: res.data.data.logoUrl || null, // Asegurar null si no viene
            primaryColor: res.data.data.primaryColor || prev.primaryColor,
            secondaryColor: res.data.data.secondaryColor || prev.secondaryColor,
          }));
        } else {
          console.error('Branding API error:', res.data.message);
          setBrandingError(res.data.message || 'No se pudo cargar la información de este portal.');
        }
      })
      .catch((error) => {
        console.error('Error fetching branding data:', error);
        setBrandingError('Error al conectar con el servidor de configuración.');
      })
      .finally(() => {
        setBrandingLoading(false);
      });
  }, []); // Ejecutar solo una vez al montar

  // --- Funciones de Manejo ---
  const handleChange = (e) => {
    setTicketData({ ...ticketData, [e.target.name]: e.target.value });
  };

  const handleSearch = async () => {
    const { ticketNumber, amount, date } = ticketData;
    if (!ticketNumber || !amount || !date) {
      toast.error('Por favor, completa todos los campos.');
      return;
    }
    setLoading(true);
    setSelectedTicket(null);
    setSearchPerformed(true);
    const apiUrl = process.env.REACT_APP_API_URL;
    try {
      // Endpoint para buscar ticket (DEBE SER PÚBLICO o usar API Key)
      const response = await axios.post(`${apiUrl}/api/tickets/search`, {
        subdomain: getSubdomain(), // Enviar subdominio para buscar en el POS correcto
        ticketNumber,
        amount,
        date
      });
      if (response.data.success && response.data.data) {
        if (!response.data.data.restaurantId) { // Asegura que el backend devuelva esto
          toast.error("Error interno al buscar ticket (Info Restaurante).");
          setSelectedTicket(null);
        } else {
          setSelectedTicket(response.data.data);
          toast.success('Ticket encontrado.');
        }
      } else {
        setSelectedTicket(null);
        toast.error(response.data.message || 'Ticket no encontrado.');
      }
    } catch (error) {
      console.error('Error al buscar ticket:', error);
      toast.error('Error al conectar con el servidor de búsqueda.');
    } finally {
      setLoading(false);
    }
  };

  const handleFacturar = () => {
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!email || !selectedTicket?.id || !selectedTicket?.restaurantId) {
      toast.error('Falta información para facturar.');
      return;
    }
    setLoading(true);
    const apiUrl = process.env.REACT_APP_API_URL;
    try {
      // Endpoint para timbrar (DEBE SER PÚBLICO o usar API Key)
      const response = await axios.post(`${apiUrl}/api/timbrado/timbrar`, {
        restaurantId: selectedTicket.restaurantId,
        ticketId: selectedTicket.id, // O el número de ticket si la API lo prefiere
        facturaData: { email: email }
      });
      if (response.data.success) {
        toast.success(`Factura generada. Se enviará a ${email}.`);
        setIsModalOpen(false);
        setSelectedTicket(null);
        setEmail('');
        setSearchPerformed(false);
        setTicketData({ ticketNumber: '', amount: '', date: '' }); // Limpiar formulario
      } else {
        toast.error(response.data.message || 'Error al generar la factura.');
      }
    } catch (error) {
      console.error('Error al timbrar:', error);
      const errorMsg = error.response?.data?.message || error.response?.data?.details || 'Error de comunicación al facturar.';
      toast.error(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    if (!loading) setIsModalOpen(false);
  };

  // --- Componentes Reutilizables ---
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  // --- Renderizado ---
  if (brandingLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="text-center p-6">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#3B82F6' }} />
          <h2 className="text-xl font-medium text-gray-700">Cargando Portal...</h2>
          <p className="text-gray-500 mt-2">Espere un momento por favor</p>
        </div>
      </div>
    );
  }

  if (brandingError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-6">{brandingError}</p>
          <p className="text-sm text-gray-500">Verifica la URL o contacta al restaurante.</p>
        </div>
      </div>
    );
  }

  // Calcular contraste para decidir si usar texto blanco o negro sobre el color primario
  const getBrightness = (hexColor) => {
    // Convertir hex a RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    // Calcular percepción de brillo (fórmula estándar)
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  const primaryTextColor = getBrightness(branding.primaryColor) > 128 ? '#000000' : '#FFFFFF';
  
  // Estilos dinámicos con CSS variables para mayor flexibilidad
  const primaryStyle = { 
    backgroundColor: branding.primaryColor, 
    color: primaryTextColor 
  };
  
  const secondaryStyle = { 
    backgroundColor: branding.secondaryColor
  };

  // Formato para fecha en español
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString + 'T00:00:00-06:00').toLocaleDateString('es-MX', options);
  };

  // Formato para moneda
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN',
      minimumFractionDigits: 2 
    }).format(parseFloat(amount));
  };

  return (
    <div className="min-h-screen flex flex-col" style={secondaryStyle}>
      <ToastContainer 
        position="top-right" 
        autoClose={5000} 
        hideProgressBar={false} 
        newestOnTop 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme="light" 
      />
      
      {/* Header con gradiente sutil */}
      <header className="py-4 px-6 w-full shadow-md" style={{
        background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.primaryColor}ee)`
      }}>
        <div className="max-w-7xl mx-auto flex items-center justify-center md:justify-start">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="h-12 object-contain" />
          ) : (
            <Ticket className="w-10 h-10" style={{ color: primaryTextColor }} />
          )}
          <h1 className="text-xl md:text-2xl font-bold ml-3" style={{ color: primaryTextColor }}>
            {branding.portalName}
          </h1>
        </div>
      </header>
      
      {/* Contenido principal */}
      <main className="flex-grow flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md lg:max-w-lg">
          {/* Card principal */}
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            {/* Área de cabecera */}
            <div className="p-6 text-center" style={primaryStyle}>
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: primaryTextColor }}>
                Facturación de Ticket
              </h2>
              <p className="mt-2 opacity-90" style={{ color: primaryTextColor }}>
                Ingresa los detalles de tu consumo para generar tu factura
              </p>
            </div>
            
            {/* Formulario de búsqueda */}
            <div className="p-6 md:p-8">
              <div className="space-y-5">
                <div className="relative">
                  <label htmlFor="ticketNumber" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                    Número de Ticket
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Ticket className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="ticketNumber"
                      name="ticketNumber"
                      type="text"
                      className="focus:ring-2 focus:ring-offset-0 block w-full pl-10 pr-3 py-3 text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none transition-all duration-200 ease-in-out"
                      style={{ 
                        borderColor: ticketData.ticketNumber ? branding.primaryColor : '#D1D5DB',
                        boxShadow: ticketData.ticketNumber ? `0 0 0 1px ${branding.primaryColor}` : 'none'
                      }}
                      placeholder="Ej. 1234"
                      value={ticketData.ticketNumber}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="relative">
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                    Monto Total
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      className="focus:ring-2 focus:ring-offset-0 block w-full pl-10 pr-3 py-3 text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none transition-all duration-200 ease-in-out"
                      style={{ 
                        borderColor: ticketData.amount ? branding.primaryColor : '#D1D5DB',
                        boxShadow: ticketData.amount ? `0 0 0 1px ${branding.primaryColor}` : 'none'
                      }}
                      placeholder="Ej. 1250.00"
                      value={ticketData.amount}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="relative">
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                    Fecha de Consumo
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="date"
                      name="date"
                      type="date"
                      className="focus:ring-2 focus:ring-offset-0 block w-full pl-10 pr-3 py-3 text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none transition-all duration-200 ease-in-out"
                      style={{ 
                        borderColor: ticketData.date ? branding.primaryColor : '#D1D5DB',
                        boxShadow: ticketData.date ? `0 0 0 1px ${branding.primaryColor}` : 'none'
                      }}
                      value={ticketData.date}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSearch}
                  disabled={loading || !ticketData.ticketNumber || !ticketData.amount || !ticketData.date}
                  className="w-full flex items-center justify-center py-3 px-4 rounded-lg text-base font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ease-in-out"
                  style={{
                    ...primaryStyle,
                    opacity: (loading || !ticketData.ticketNumber || !ticketData.amount || !ticketData.date) ? 0.7 : 1,
                    transform: loading ? 'scale(0.98)' : 'scale(1)'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Buscar Ticket
                    </>
                  )}
                </button>
              </div>

              {/* Resultados de búsqueda */}
              {searchPerformed && (
                <div className="mt-8">
                  {selectedTicket ? (
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 animate-fadeIn">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Ticket Encontrado</h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Válido para facturar
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-gray-600">Número de Ticket</span>
                          <span className="font-medium text-gray-900">{selectedTicket.ticketNumber}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-gray-600">Monto Total</span>
                          <span className="font-medium text-gray-900">{formatCurrency(selectedTicket.amount)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                          <span className="text-gray-600">Fecha de Consumo</span>
                          <span className="font-medium text-gray-900">{formatDate(selectedTicket.date)}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={handleFacturar}
                        className="w-full mt-6 py-3 px-4 rounded-lg text-white font-medium flex items-center justify-center shadow-sm hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-300 ease-in-out"
                        style={{ backgroundColor: '#16A34A' }}
                      >
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Generar Factura
                      </button>
                    </div>
                  ) : (
                    <div className="bg-red-50 rounded-lg p-6 border border-red-100 text-center animate-fadeIn">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                        <X className="h-6 w-6 text-red-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">No se encontró el ticket</h3>
                      <p className="text-gray-600 mb-6">
                        Verifica que los datos sean correctos e intenta nuevamente.
                      </p>
                      <div className="text-sm text-gray-500">
                        <p>Asegúrate de que:</p>
                        <ul className="mt-2 list-disc list-inside">
                          <li>El número de ticket sea correcto</li>
                          <li>El monto coincida exactamente con tu ticket</li>
                          <li>La fecha corresponda al día de tu visita</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Footer con info adicional */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Si necesitas ayuda, contacta al restaurante o escribe a soporte@nextmanager.com.mx
            </p>
          </div>
        </div>
      </main>

      {/* Modal mejorado */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel="Formulario de Facturación"
        className="modal-content bg-white rounded-xl shadow-2xl p-0 max-w-md mx-auto my-10 outline-none"
        overlayClassName="modal-overlay fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      >
        <div className="relative">
          {/* Header del modal */}
          <div className="p-6 text-center rounded-t-xl" style={primaryStyle}>
            <button
              onClick={closeModal}
              disabled={loading}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-opacity-10 hover:bg-black focus:outline-none transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" style={{ color: primaryTextColor }} />
            </button>
            <div className="mb-2">
              <Mail className="h-10 w-10 mx-auto" style={{ color: primaryTextColor }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: primaryTextColor }}>
              Enviar Factura por Correo
            </h2>
            <p className="mt-1 text-sm opacity-90" style={{ color: primaryTextColor }}>
              Recibirás tu factura en formato PDF y XML
            </p>
          </div>
          
          {/* Contenido del modal */}
          <div className="p-6">
            <form onSubmit={handleModalSubmit}>
              <div className="mb-6">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1 ml-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    className="focus:ring-2 focus:ring-offset-0 block w-full pl-10 pr-3 py-3 text-gray-900 placeholder-gray-400 border border-gray-300 rounded-lg focus:outline-none transition-all duration-200 ease-in-out"
                    style={{ 
                      borderColor: email ? branding.primaryColor : '#D1D5DB',
                      boxShadow: email ? `0 0 0 1px ${branding.primaryColor}` : 'none'
                    }}
                    placeholder="nombre@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Revisa que tu correo sea correcto, ahí recibirás tu factura.
                </p>
              </div>
              
              {/* Resumen del ticket */}
              {selectedTicket && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Resumen del ticket</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Ticket:</span>
                      <span className="font-medium">{selectedTicket.ticketNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monto:</span>
                      <span className="font-medium">{formatCurrency(selectedTicket.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fecha:</span>
                      <span className="font-medium">{formatDate(selectedTicket.date)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="flex-1 flex justify-center items-center py-3 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ease-in-out"
                  style={{
                    ...primaryStyle,
                    opacity: (loading || !email) ? 0.7 : 1
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                      Procesando...
                    </>
                  ) : (
                    'Enviar Factura'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default App;