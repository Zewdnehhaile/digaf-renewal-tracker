import React, { useState, useEffect, useRef } from 'react';
import { User, Customer, ActivityLog, AIConfig, OfficerAIPermission, AttendanceRecord, AttendanceStatus } from '../types';
import { 
  Sparkles, 
  X, 
  Send, 
  MessageSquare, 
  Bot, 
  ArrowRight, 
  Building2, 
  Layers, 
  HelpCircle,
  AlertTriangle,
  UserCheck,
  Zap,
  PhoneCall,
  Loader,
  Save,
  CheckCircle,
  Download,
  FileText
} from 'lucide-react';
import { soundService } from '../services/sound';
import { dbService } from '../services/db';
import { useLanguage } from '../services/language';
import AIExportButton from './AIExportButton';

interface AIAssistantDrawerProps {
  currentUser: User;
  customers: Customer[];
  logs: ActivityLog[];
  aiConfig: AIConfig | null;
  officerPermissions: OfficerAIPermission[];
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function AIAssistantDrawer({ 
  currentUser, 
  customers, 
  logs, 
  aiConfig, 
  officerPermissions 
}: AIAssistantDrawerProps) {
  // ===== ALL HOOKS MUST COME FIRST =====
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);

  const isZewdneh = !!(currentUser?.fullName?.toLowerCase().includes('zewd') || currentUser?.phoneNumber?.toLowerCase().includes('zewd'));
  const officerPerm = officerPermissions.find(p => p.phoneNumber === currentUser.phoneNumber);
  const isGlobalEnabled = aiConfig ? aiConfig.featuresEnabled : true;
  const isAllowed = isZewdneh || isGlobalEnabled;
  const isChatAllowed = isZewdneh || (isGlobalEnabled && (officerPerm?.assistantPanelAllowed !== false));

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(`digaf_chat_history_${currentUser.phoneNumber}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
        }
      }
    } catch (e) {
      console.warn("Could not load chat history", e);
    }
    return [];
  });

  // Custom interactive tab & Image Generator states
  const [activeTab, setActiveTab] = useState<'chat' | 'image'>('chat');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgCategory, setImgCategory] = useState('Avatar');
  const [generatedImg, setGeneratedImg] = useState('');
  const [generatingImg, setGeneratingImg] = useState(false);
  const [imgError, setImgError] = useState('');

  // Canva-Style Smart Contract Digitizer & Audit Canvas Workspace states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [analyzingDoc, setAnalyzingDoc] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [borrowerName, setBorrowerName] = useState('ብርቱካን አሰፋ');
  const [phoneNumber, setPhoneNumber] = useState('0586248521');
  const [signedDate, setSignedDate] = useState('27/09/2018');
  const [existingPayDate, setExistingPayDate] = useState('27/09/2018');
  const [dueDate, setDueDate] = useState('27/10/2018');
  const [loanAmount, setLoanAmount] = useState('7000');
  const [serviceFee, setServiceFee] = useState('500');
  const [interestRate, setInterestRate] = useState('0.5% daily');
  const [aiPrompt, setAiPrompt] = useState('');
  const [editingWithPrompt, setEditingWithPrompt] = useState(false);
  const [promptFeedback, setPromptFeedback] = useState('');
  const [isDigitizedSuccessfully, setIsDigitizedSuccessfully] = useState(false);
  const [isStampAffixed, setIsStampAffixed] = useState(false);
  const [isSignatureAffixed, setIsSignatureAffixed] = useState(false);

  // Confidence Statistics States
  const [agreementConfidence, setAgreementConfidence] = useState<number>(0.94);
  const [payConfidence, setPayConfidence] = useState<number>(0.96);

  // Edited Image base64 String
  const [editedImageSrc, setEditedImageSrc] = useState<string>('');

  // Draggable / Adjustable calibration coordinates
  const [textPercentX, setTextPercentX] = useState(48.5);
  const [textPercentY, setTextPercentY] = useState(44.6);
  const [erasePercentX, setErasePercentX] = useState(93.0);
  const [erasePercentY, setErasePercentY] = useState(35.2);
  const [erasePercentW, setErasePercentW] = useState(14.0);
  const [erasePercentH, setErasePercentH] = useState(2.5);

  const bottomRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedElement, setDraggedElement] = useState<'date' | 'eraser' | null>(null);

  // ===== ALL useEffect HOOKS =====
  useEffect(() => {
    if (!currentUser) return;
    const unsubAttendance = dbService.subscribeAttendanceRecords((records) => {
      const filtered = records.filter(r => r.phoneNumber === currentUser.phoneNumber);
      setAttendanceRecords(filtered);
    });
    return () => unsubAttendance();
  }, [currentUser]);

  // Save chat memories to localStorage when updated
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`digaf_chat_history_${currentUser.phoneNumber}`, JSON.stringify(messages));
    }
  }, [messages, currentUser.phoneNumber]);

  // Auto-greeting based on role
  useEffect(() => {
    if (messages.length === 0 && currentUser) {
      let greeting = '';
      if (language === 'am') {
        greeting = isZewdneh
          ? `ሰላም አስተዳዳሪ **ዘውድነህ**። እኔ የዲጋፍ አርተፊሻል ኢንተለጀንስ (AI) የክንውን ረዳትዎ ነኝ። የአፈጻጸም ትንታኔዎችን፣ የሂደት ጤና ሬሾዎችን እና የስትራቴጂክ ማነቆ ማስጠንቀቂያዎችን ሙሉ በሙሉ ማግኘት ይችላሉ። ዛሬ የብድር እድሳትን በተመለከተ እንዴት ልረዳዎት እችላለሁ?`
          : `ሰላም መኮንን **${currentUser.fullName}**። እኔ የዲጋፍ የእድሳት ግንኙነት ረዳት ነኝ። በመጠባበቅ ላይ ያሉ ክትትልዎችን ማሳየት፣ በርስዎ ፖርትፎሊዮ ስር የቆሙ አካውንቶችን መገምገም ወይም የዕለት ተዕለት የእድሳት ግቦችን ማጠቃለል እችላለሁ። ምን መፈተሽ ይፈልጋሉ?`;
      } else if (language === 'om') {
        greeting = isZewdneh
          ? `Akkam Bulchaa **Zewdneh**. Ani gargaara keessan intallijensii hojii Digaf AI ti. Xiinxala raawwii, reeshyoolee fayyaa madda hojii fi fannoo bottlenecks hunda argachuu ni dandeessu. Haaromsa liqii irratti har'a akkamitti isin gargaaruu danda'a?`
          : `Akkam Hojjetaa **${currentUser.fullName}**. Ani gargaara qunnamtii haaromsa Digaf ti. Hordoffii keessan hafan isinii agarsiisuu, herrega portfolio keessan jala turan madaaluu ykn cuunfaa galma haaromsa guyyaa dhiheessuu nan danda'a. Maal mirkaneessuu barbaaddu?`;
      } else {
        greeting = isZewdneh 
          ? `Hello Administrator **Zewdneh**. I am your Digaf AI operational intelligence companion. You have full access to performance analytics, pipeline health ratios, and strategic bottleneck alerts. How can I assist you with credit renewals today?`
          : `Greeting Officer **${currentUser.fullName}**. I am the Digaf renewal relations assistant. I can show you your pending follow-ups, evaluate accounts stalled under your portfolio, or summarize daily conversion targets. What would you like to check?`;
      }
      
      setMessages([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          text: greeting,
          timestamp: new Date()
        }
      ]);
    }
  }, [currentUser, isZewdneh, messages.length, language]);

  // Scroll to bottom
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Sync initial coordinate sets depending on whether custom file or mock is loaded
  useEffect(() => {
    if (uploadedImage) {
      setTextPercentX(19.0);
      setTextPercentY(37.9);
      setErasePercentX(93.0);
      setErasePercentY(35.2);
    } else {
      setTextPercentX(48.5);
      setTextPercentY(44.6);
    }
  }, [uploadedImage]);

  // Run business date correction triggers whenever input dates adapt
  useEffect(() => {
    if (!signedDate || !signedDate.includes('/')) return;
    
    const calculated = calculatePayDate(signedDate);
    
    if (!existingPayDate || existingPayDate.trim() === '' || existingPayDate === '[BLANK]') {
      setDueDate(calculated);
    } else {
      const existingParts = existingPayDate.split('/');
      const signedParts = signedDate.split('/');

      if (existingParts.length === 3 && signedParts.length === 3 && existingParts[1] === signedParts[1]) {
        setDueDate(calculated);
      } else {
        setDueDate(calculated);
      }
    }
  }, [signedDate, existingPayDate]);

  // Master Canvas Redrawing Engine
  useEffect(() => {
    const cnvs = document.createElement('canvas');
    cnvs.width = 1000;
    cnvs.height = 1400;
    const ctx = cnvs.getContext('2d');
    if (!ctx) return;

    const finalizeDrawAndPreview = () => {
      if (dueDate) {
        ctx.save();
        
        let textX = (textPercentX / 100) * cnvs.width;
        let textY = (textPercentY / 100) * cnvs.height;

        if (uploadedImage) {
          const eraseX = (erasePercentX / 100) * cnvs.width;
          const eraseY = (erasePercentY / 100) * cnvs.height;
          const eraseW = (erasePercentW / 100) * cnvs.width;
          const eraseH = (erasePercentH / 100) * cnvs.height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(eraseX - eraseW / 2, eraseY - eraseH / 2, eraseW, eraseH);
          textX = (textPercentX / 100) * cnvs.width;
          textY = (textPercentY / 100) * cnvs.height;
        }

        const refWidth = cnvs.width;
        const fontSize = Math.max(12, Math.round((16 / 1000) * refWidth));
        const rectHeight = uploadedImage ? Math.max(18, Math.round((26 / 1000) * refWidth)) : Math.max(14, Math.round((20 / 1000) * refWidth));
        const rectWidth = uploadedImage ? Math.max(110, Math.round((140 / 1000) * refWidth)) : Math.max(85, Math.round((100 / 1000) * refWidth));
        const underlineOffset = Math.max(4, Math.round((9 / 1000) * refWidth));

        if (!uploadedImage) {
          ctx.fillStyle = '#FAF8F5'; 
          ctx.fillRect(textX - rectWidth / 2, textY - rectHeight * 0.5, rectWidth, rectHeight);
        }

        ctx.fillStyle = '#000000'; 
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dueDate, textX, textY);

        if (!uploadedImage) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(1, Math.round((1.2 / 1000) * refWidth));
          ctx.beginPath();
          ctx.moveTo(textX - rectWidth * 0.45, textY + underlineOffset);
          ctx.lineTo(textX + rectWidth * 0.45, textY + underlineOffset);
          ctx.stroke();
        }

        ctx.restore();
      }

      setEditedImageSrc(cnvs.toDataURL('image/jpeg', 0.95));
    };

    if (uploadedImage) {
      const imgElement = new Image();
      imgElement.crossOrigin = 'anonymous';
      imgElement.src = uploadedImage;
      imgElement.onload = () => {
        cnvs.width = imgElement.naturalWidth || 1000;
        cnvs.height = imgElement.naturalHeight || 1400;
        ctx.drawImage(imgElement, 0, 0, cnvs.width, cnvs.height);
        finalizeDrawAndPreview();
      };
      imgElement.onerror = () => {
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, cnvs.width, cnvs.height);
        finalizeDrawAndPreview();
      };
    } else {
      drawFallbackTemplateOnCanvas(cnvs, ctx);
      finalizeDrawAndPreview();
    }
  }, [
    uploadedImage, signedDate, dueDate, existingPayDate, borrowerName, phoneNumber, 
    loanAmount, serviceFee, interestRate, 
    textPercentX, textPercentY, erasePercentX, erasePercentY, erasePercentW, erasePercentH
  ]);

  // ===== CONDITIONAL RETURN (AFTER ALL HOOKS) =====
  if (!isAllowed) {
    return null;
  }

  // ===== HELPER FUNCTIONS =====
  const calculatePayDate = (agreementDateStr: string): string => {
    if (!agreementDateStr || !agreementDateStr.includes('/')) return '';
    const parts = agreementDateStr.split('/');
    if (parts.length !== 3) return '';
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return '';

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }

    const tempDate = new Date(year, month, 0);
    const maxDays = tempDate.getDate();
    if (day > maxDays) {
      day = maxDays;
    }

    const paddedDay = String(day).padStart(2, '0');
    const paddedMonth = String(month).padStart(2, '0');
    return `${paddedDay}/${paddedMonth}/${year}`;
  };

  const drawFallbackTemplateOnCanvas = (cnvs: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, cnvs.width, cnvs.height);

    ctx.strokeStyle = '#D1FAE5'; 
    ctx.lineWidth = 25;
    ctx.strokeRect(12.5, 12.5, cnvs.width - 25, cnvs.height - 25);

    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, cnvs.width - 60, cnvs.height - 60);

    ctx.fillStyle = 'rgba(139, 92, 246, 0.035)';
    ctx.font = 'extrabold 180px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DIGAF', cnvs.width / 2, cnvs.height / 2);

    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('ዲጋፍ የማይክሮ አስቸኳይ ብድር አቅራቢ አ.ማ', cnvs.width / 2, 95);

    ctx.fillStyle = '#4B5563';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText('Digaf Urgent Salary Microcredit Provider S.C.', cnvs.width / 2, 135);

    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 160);
    ctx.lineTo(cnvs.width - 50, 160);
    ctx.stroke();

    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'left';
    ctx.fillText('Office: Bole, Addis Ababa', 60, 190);
    ctx.textAlign = 'right';
    ctx.fillText('Doc Ref: DSC-RENEW-2026-081', cnvs.width - 60, 190);

    ctx.fillStyle = '#F3F4F6';
    ctx.fillRect(50, 220, cnvs.width - 100, 55);
    ctx.strokeStyle = '#E5E7EB';
    ctx.strokeRect(50, 220, cnvs.width - 100, 55);

    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.font = '900 20px sans-serif';
    ctx.fillText('የደመወዝ አስቸኳይ ብድር ውል ስምምነት • SALARY AGREEMENT', cnvs.width / 2, 255);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`የተበዳሪው ስም / Borrower:   ${borrowerName}`, 70, 340);
    ctx.fillText(`ስልክ ቁጥር / Phone:   ${phoneNumber}`, 560, 340);

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#E5E7EB';
    ctx.beginPath();
    ctx.moveTo(50, 375);
    ctx.lineTo(cnvs.width - 50, 375);
    ctx.stroke();

    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('Clause 1.1', 70, 440);
    ctx.font = '17px sans-serif';
    ctx.fillText(`ይህ የብድር ውል ስምምነት ባልደረባው ማይክሮፋይናንስ በ   ${signedDate} ዓ.ም ተዋዋይ ወገኖች ባሉበት ተፈርሟል።`, 70, 475);

    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('Clause 1.2 [የብድር መጠንና ክፍያ / Amount & Due Date Terms]', 70, 550);
    ctx.font = '17px sans-serif';
    ctx.fillText(`ተበዳሪው የወሰደው የብድር መጠን ጠቅላላ   ${loanAmount} ETB ሲሆን፣`, 70, 585);
    ctx.fillText(`ይህንኑ ክፍያ እስከ መጨረሻው የጊዜ ገደብ                                ዓ.ም ድረስ ሙሉ በሙሉ ለመክፈል ተስማምቷል።`, 70, 625);

    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('Clause 1.3', 70, 700);
    ctx.font = '17px sans-serif';
    ctx.fillText(`ለብድሩ ማስተዳደሪያ የአገልግሎት ክፍያ ብር   ${serviceFee} ETB በቅድሚያ የተቆረጠ መሆኑን ይስማማል።`, 70, 735);

    ctx.fillStyle = '#6B7280';
    ctx.font = 'bold italic 14px "Courier New", monospace';
    ctx.fillText(`* በውሉ የዕለት ቅጣት መመሪያ 1.4 መሠረት ካለፈበት ቀን በየዕለቱ የ ${interestRate} ወለድ ይቀጣል።`, 70, 810);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#D1D5DB';
    ctx.beginPath();
    ctx.moveTo(50, 900);
    ctx.lineTo(cnvs.width - 50, 900);
    ctx.stroke();

    ctx.fillStyle = '#374151';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('የተበዳሪ ፊርማ (Borrower Sign):', 70, 950);
    ctx.fillText('ዲጋፍ አስተዳዳሪ (Officer Seal):', 580, 950);

    ctx.font = 'italic 16px sans-serif';
    ctx.fillText(borrowerName, 70, 1075);
    ctx.fillText('Zewdneh System Admin', 580, 1075);

    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 1050);
    ctx.lineTo(350, 1050);
    ctx.moveTo(580, 1050);
    ctx.lineTo(880, 1050);
    ctx.stroke();
  };

  const handleResetChat = () => {
    const confirmationText = language === 'am' 
      ? 'እርግጠኛ ነዎት የውይይቱን ታሪክ ሙሉ በሙሉ ማጥፋት ይፈልጋሉ?' 
      : language === 'om' 
        ? 'Dhuguma seenaa haasaa keessanii guutummatti haquu ni barbaadduu?' 
        : 'Are you sure you want to clear conversation memory?';
        
    if (window.confirm(confirmationText)) {
      localStorage.removeItem(`digaf_chat_history_${currentUser.phoneNumber}`);
      setMessages([]);
      soundService.playSuccessChime();
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputVal).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: 'usrmsg-' + Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };
    
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputVal('');
    setLoading(true);
    soundService.playSuccessChime();

    try {
      const conversationHistory = nextMessages
        .filter(m => m.id !== 'welcome-msg' && !m.id.startsWith('err-') && m.id !== userMsg.id)
        .slice(-12)
        .map(m => ({
          sender: m.sender,
          text: m.text
        }));

      let finalCustomers = customers;
      let finalLogs = logs;
      if (!isZewdneh) {
        finalCustomers = customers.filter(c => c.addedBy === currentUser.fullName || c.addedBy === currentUser.phoneNumber);
        finalLogs = logs.filter(l => l.updatedBy === currentUser.fullName || l.updatedBy === currentUser.phoneNumber);
      }

      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: textToSend,
          history: conversationHistory,
          customers: finalCustomers,
          logs: finalLogs,
          username: currentUser.fullName,
          language,
          currentUser,
          attendanceRecords
        })
      });

      if (!response.ok) {
        throw new Error('Communication break down on AI service.');
      }

      const data = await response.json();
      
      if (Array.isArray(data.actions) && data.actions.length > 0) {
        for (const action of data.actions) {
          try {
            const { type, payload } = action;
            switch (type) {
              case 'UPDATE_CUSTOMER': {
                if (payload.customerId && payload.updates) {
                  const targetCust = customers.find(c => c.id === payload.customerId);
                  if (!isZewdneh && targetCust && targetCust.addedBy !== currentUser.fullName && targetCust.addedBy !== currentUser.phoneNumber) {
                    console.warn("Unauthorized attempt by officer to update customer of another portfolio.");
                    break;
                  }
                  await dbService.updateCustomer(payload.customerId, payload.updates, currentUser.fullName);
                }
                break;
              }
              case 'ADD_CUSTOMER': {
                if (payload.name) {
                  await dbService.addCustomer({
                    name: payload.name,
                    phoneNumber: payload.phoneNumber || '+251 900 000 000',
                    status: payload.status || 'Renewal Processing',
                    addedBy: currentUser.fullName,
                    notes: payload.notes || 'Created via AI Assistant update order',
                    followUpDate: payload.followUpDate
                  });
                }
                break;
              }
              case 'DELETE_CUSTOMER': {
                if (isZewdneh && payload.customerId) {
                  await dbService.deleteCustomer(payload.customerId);
                }
                break;
              }
              case 'CREATE_ATTENDANCE': {
                if (isZewdneh && payload.employeePhone) {
                  const matchingOfficer = officerPermissions.find(p => p.phoneNumber === payload.employeePhone);
                  const employeeName = matchingOfficer ? (matchingOfficer.fullName || matchingOfficer.phoneNumber) : 'Staff Member';
                  const checkedStatus = payload.status || 'Present';
                  const newAttRec: AttendanceRecord = {
                    id: `att-${payload.date || new Date().toISOString().split('T')[0]}-${payload.window || 'Morning'}-${payload.employeePhone}`,
                    phoneNumber: payload.employeePhone,
                    employeeName: employeeName,
                    employeeRole: matchingOfficer ? 'Officer' : 'Staff',
                    date: payload.date || new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
                    attendanceType: payload.window || 'Morning',
                    status: checkedStatus as AttendanceStatus,
                    gpsCoordinates: {
                      latitude: 0,
                      longitude: 0,
                      isInside: true,
                      distanceText: '0m',
                      accuracy: 1
                    },
                    deviceInformation: 'Digaf AI Action Center Bot'
                  };
                  await dbService.saveAttendanceRecord(newAttRec);
                }
                break;
              }
              case 'DELETE_ATTENDANCE': {
                if (isZewdneh && payload.recordId) {
                  await dbService.deleteAttendanceRecord(payload.recordId);
                }
                break;
              }
              default:
                console.warn("Unknown AI action item:", type);
            }
          } catch (actionErr: any) {
            console.error("Action execution error:", actionErr);
          }
        }
      }
      
      const assistantMsg: Message = {
        id: 'aimsg-' + Math.random().toString(36).substring(2, 9),
        sender: 'assistant',
        text: data.answer || "I parsed the database metrics but couldn't formulate a response. Please retry.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);
      soundService.playSuccessChime();
      
      await dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        'ASSISTANT_PANEL',
        `Asked question: "${textToSend.substring(0, 40)}..."`
      );

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: 'err-' + Math.random(),
        sender: 'assistant',
        text: `⚠️ Operator Communication Alert: ${err.message || 'The AI server did not reply.'}`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imgPrompt.trim() || generatingImg) return;
    setGeneratingImg(true);
    setGeneratedImg('');
    setImgError('');
    soundService.playSuccessChime();
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: imgPrompt,
          category: imgCategory,
          username: currentUser.fullName
        })
      });

      if (!res.ok) {
        let serverError = 'Image Synthesizer was blocked or offline.';
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            serverError = errData.error;
          }
        } catch (parseErr) {}
        throw new Error(serverError);
      }

      const data = await res.json();
      const mime = data.mimeType || 'image/jpeg';
      setGeneratedImg(`data:${mime};base64,${data.base64}`);
      soundService.playSuccessChime();

      await dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        'IMAGE_GENERATION',
        `Synthesized a graphics asset: "${imgPrompt.substring(0, 45)}"`
      );
    } catch (err: any) {
      setImgError(err.message || 'Failed to synthesize asset');
    } finally {
      setGeneratingImg(false);
    }
  };

  const triggerContractAudit = async (customImageBase64?: string) => {
    setAnalyzingDoc(true);
    setAuditResult(null);
    setIsDigitizedSuccessfully(false);
    try {
      const res = await fetch('/api/ai/analyze-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: customImageBase64 || uploadedImage || '',
          language: language,
          isSample: !customImageBase64 && !uploadedImage
        })
      });
      const data = await res.json();
      setAuditResult(data);
      
      if (data.borrowerName) setBorrowerName(data.borrowerName);
      if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
      if (data.signedDate) setSignedDate(data.signedDate);
      if (data.dueDate) setDueDate(data.dueDate);
      if (data.loanAmount) setLoanAmount(String(data.loanAmount));
      if (data.serviceFee) setServiceFee(String(data.serviceFee));
      if (data.interestRate) setInterestRate(data.interestRate);

      soundService.playSuccessChime();

      await dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        'CANVA_AUDIT',
        `Ran AI Contract Audit & Auto-fill: Detected Clause 1.2 Date Omission`
      );
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzingDoc(false);
    }
  };

  const handleRunContractPromptEdit = async () => {
    if (!aiPrompt.trim() || editingWithPrompt) return;
    setEditingWithPrompt(true);
    setPromptFeedback('');
    try {
      const res = await fetch('/api/ai/edit-contract-via-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userPrompt: aiPrompt,
          language: language,
          currentState: {
            borrowerName,
            phoneNumber,
            signedDate,
            dueDate,
            loanAmount,
            serviceFee,
            interestRate,
            isStampAffixed,
            isSignatureAffixed
          }
        })
      });

      if (!res.ok) {
        throw new Error('AI contract editing service failed.');
      }

      const data = await res.json();
      if (data.borrowerName) setBorrowerName(data.borrowerName);
      if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
      if (data.signedDate) setSignedDate(data.signedDate);
      if (data.dueDate) setDueDate(data.dueDate);
      if (data.loanAmount) setLoanAmount(String(data.loanAmount));
      if (data.serviceFee) setServiceFee(String(data.serviceFee));
      if (data.interestRate) setInterestRate(data.interestRate);
      setPromptFeedback(data.reasoning || 'Successfully updated fields via AI natural instruction.');
      soundService.playSuccessChime();

      await dbService.addAIUsageLog(
        currentUser.fullName,
        currentUser.phoneNumber,
        'CANVA_PROMPT_EDIT',
        `Edited contract via custom prompt: "${aiPrompt.substring(0, 40)}..."`
      );

    } catch (err: any) {
      setPromptFeedback(`⚠️ AI Editing Error: ${err.message || 'No reply from server'}`);
    } finally {
      setEditingWithPrompt(false);
    }
  };

  const downloadAsFormat = (format: 'jpg' | 'png' | 'pdf') => {
    const cnvs = document.createElement('canvas');
    cnvs.width = 1000;
    cnvs.height = 1400;
    const ctx = cnvs.getContext('2d');
    if (!ctx) return;

    const executeDownload = () => {
      if (dueDate) {
        ctx.save();
        
        let textX = (textPercentX / 100) * cnvs.width;
        let textY = (textPercentY / 100) * cnvs.height;

        if (uploadedImage) {
          const eraseX = (erasePercentX / 100) * cnvs.width;
          const eraseY = (erasePercentY / 100) * cnvs.height;
          const eraseW = (erasePercentW / 100) * cnvs.width;
          const eraseH = (erasePercentH / 100) * cnvs.height;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(eraseX - eraseW / 2, eraseY - eraseH / 2, eraseW, eraseH);
          textX = (textPercentX / 100) * cnvs.width;
          textY = (textPercentY / 100) * cnvs.height;
        }

        const refWidth = cnvs.width;
        const fontSize = Math.max(12, Math.round((16 / 1000) * refWidth));
        const rectHeight = uploadedImage ? Math.max(18, Math.round((26 / 1000) * refWidth)) : Math.max(14, Math.round((20 / 1000) * refWidth));
        const rectWidth = uploadedImage ? Math.max(110, Math.round((140 / 1000) * refWidth)) : Math.max(85, Math.round((100 / 1000) * refWidth));
        const underlineOffset = Math.max(4, Math.round((9 / 1000) * refWidth));

        if (!uploadedImage) {
          ctx.fillStyle = '#FAF8F5'; 
          ctx.fillRect(textX - rectWidth / 2, textY - rectHeight * 0.5, rectWidth, rectHeight);
        }

        ctx.fillStyle = '#000000'; 
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dueDate, textX, textY);

        if (!uploadedImage) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(1, Math.round((1.2 / 1000) * refWidth));
          ctx.beginPath();
          ctx.moveTo(textX - rectWidth * 0.45, textY + underlineOffset);
          ctx.lineTo(textX + rectWidth * 0.45, textY + underlineOffset);
          ctx.stroke();
        }

        ctx.restore();
      }

      let baseName = 'digaf_edited_contract';
      if (uploadedFileName) {
        const cleanName = uploadedFileName.replace(/\.[^/.]+$/, "");
        baseName = `${cleanName}_edited`;
      } else if (borrowerName && borrowerName !== 'Evaluating...') {
        baseName = `digaf_edited_contract_${borrowerName.replace(/\s+/g, '_')}`;
      } else {
        baseName = 'digaf_edited_contract_edited';
      }

      if (format === 'jpg') {
        const link = document.createElement('a');
        link.download = `${baseName}.jpg`;
        link.href = cnvs.toDataURL('image/jpeg', 0.95);
        link.click();
      } else if (format === 'png') {
        const link = document.createElement('a');
        link.download = `${baseName}.png`;
        link.href = cnvs.toDataURL('image/png');
        link.click();
      } else if (format === 'pdf') {
        import('jspdf').then((module) => {
          const jsPDF = module.default;
          const pdf = new jsPDF('p', 'mm', 'a4');
          const width = pdf.internal.pageSize.getWidth();
          const height = pdf.internal.pageSize.getHeight();
          const imgData = cnvs.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
          pdf.save(`${baseName}.pdf`);
        });
      }
      soundService.playSuccessChime();
    };

    if (uploadedImage) {
      const imgElement = new Image();
      imgElement.crossOrigin = 'anonymous';
      imgElement.src = uploadedImage;
      imgElement.onload = () => {
        cnvs.width = imgElement.naturalWidth || 1000;
        cnvs.height = imgElement.naturalHeight || 1400;
        ctx.drawImage(imgElement, 0, 0, cnvs.width, cnvs.height);
        executeDownload();
      };
      imgElement.onerror = () => {
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, cnvs.width, cnvs.height);
        executeDownload();
      };
    } else {
      drawFallbackTemplateOnCanvas(cnvs, ctx);
      executeDownload();
    }
  };

  const updatePositionFromEvent = (e: React.PointerEvent<HTMLDivElement>, forceElement?: 'date' | 'eraser') => {
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    let pctX = (clientX / rect.width) * 100;
    let pctY = (clientY / rect.height) * 100;
    
    pctX = Math.max(0, Math.min(100, pctX));
    pctY = Math.max(0, Math.min(100, pctY));
    
    const element = forceElement || draggedElement;
    if (element === 'eraser') {
      setErasePercentX(Number(pctX.toFixed(1)));
      setErasePercentY(Number(pctY.toFixed(1)));
    } else {
      setTextPercentX(Number(pctX.toFixed(1)));
      setTextPercentY(Number(pctY.toFixed(1)));
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;

    const distToDate = Math.hypot(pctX - textPercentX, pctY - textPercentY);
    const distToEraser = uploadedImage ? Math.hypot(pctX - erasePercentX, pctY - erasePercentY) : Infinity;

    let target: 'date' | 'eraser' = 'date';
    if (uploadedImage && distToEraser < distToDate) {
      target = 'eraser';
    }

    setDraggedElement(target);
    updatePositionFromEvent(e, target);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updatePositionFromEvent(e);
  };

  const handlePointerUpOrLeave = () => {
    setIsDragging(false);
    setDraggedElement(null);
  };

  // ===== QUICK ACTIONS =====
  const quickActions = isZewdneh ? (
    language === 'am' ? [
      { label: "የአስተዳዳሪ ማጠቃለያ", text: "የዛሬውን የአስተዳዳሪ የስራ ክምችት እና ወሳኝ የአፈጻጸም ማነቆ ቅድሚያ የሚሰጣቸውን ነገሮች አጠቃልልልኝ።" },
      { label: "የቆሙ ፋይሎች ሪፖርቶች", text: "በሂደት ላይ ሆነው በአሁኑ ጊዜ የቆሙ ወይም እንቅስቃሴ-አልባ የሆኑ የደንበኞችን አካውንቶች ለይተህ አውጣልኝ።" },
      { label: "የአፈጻጸም KPI ፍተሻ", text: "የሰራተኞች የስራ አፈጻጸም፣ የሂደት ፍጥነት እና ተገዢነት አጠቃላይ ግምገማ እፈልጋለሁ።" }
    ] : language === 'om' ? [
      { label: "Cuunfaa Hojii Bulchaa", text: "Cuunfaa hojii guyyaa har'aa fi dhimmoota dursa kennamuufii qaban gabaabsi." },
      { label: "Gabaasa Herrega Cufame", text: "Akaakuu maamilaa adeemsa keessatti fannifamanii jiran adda baasi." },
      { label: "Madaallii KPI Hojjettootaa", text: "Xiinxala raawwii hojii hojjettootaa, saffisa adeemsaa fi kabaja hojii naaf dhiheessi." }
    ] : [
      { label: "Executive Summary", text: "Summarize today's executive workload and critical performance bottleneck priorities." },
      { label: "Stuck Case Reports", text: "Identify any customer accounts currently stuck or residing inactive in the pipeline." },
      { label: "Staff Performance KPI Check", text: "I need a high-level review of the officers' performance, processing speed, and compliance." }
    ]
  ) : (
    language === 'am' ? [
      { label: "የዛሬ የክትትል ዝርዝሬ", text: `ዛሬ በእኔ ስም አስቸኳይ ክትትል የሚገባቸውን ሁሉንም የደንበኛ ፋይሎች ዘርዝርልኝ።` },
      { label: "ከ 7 ቀናት በላይ የቆሙ", text: "በስራ ሂደት ውስጥ ከአንድ ደረጃ በላይ ለ7 ቀናት በላይ የቆሙትን ሁሉንም ንቁ የደንበኛ ፋይሎች አሳየኝ።" },
      { label: "የዕለት ተዕለት ውጤቴ", text: "የእኔን ንቁ የፖርትፎሊዮ ለውጥ ሚዛን እና የተጠናቀቁ የእድሳት ግቦችን አጠቃልልልኝ።" }
    ] : language === 'om' ? [
      { label: "Hordoffii Kooti Har'aa", text: `Maamiltoota maqaa kootiin jiran kanneen har'a hordoffii barbaadan naaf barreessi.` },
      { label: "Kan Guyyoota 7 Oli Turan", text: "Fayilota maamilaa keessaa kanneen guyyoota 7 oliif achuma turan naaf agarsiisi." },
      { label: "Cuunfaa Haaromsa Kooti", text: "Cuunfaa portfolio koo fi galma haaromsa dhuunfa koo gabaabsi." }
    ] : [
      { label: "Find My Follow-Ups Required", text: `List all customer records under my name requiring urgent follow-up contact today.` },
      { label: "Find Accounts Stuck > 7 Days", text: "Show me all active pipeline items that have been stalled in their stage for over 7 days." },
      { label: "My Daily Conversion Summary", text: "Summarize my active portfolio conversion balance and completed renewal goals." }
    ]
  );

  // ===== RENDER =====
  return (
    <>
      {/* 1. FLOATING GLOWING AI TRIGGER BUTTON */}
      <div className="fixed bottom-6 right-6 z-45 flex items-center gap-2">
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            soundService.playSuccessChime();
          }}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-white p-3.5 rounded-full hover:scale-105 shadow-xl transition-all cursor-pointer select-none leading-none group font-semibold text-xs active:scale-95 animate-pulse"
          title="Query your Renewal relations intelligent assistant"
          id="floating_ai_assistant_trigger"
        >
          <Sparkles className="w-5 h-5 text-[#8B5CF6] group-hover:rotate-12 transition-transform shrink-0" />
          <span className="hidden sm:inline-block pr-1 font-sans font-bold">
            {language === 'am' ? 'ዲጋፍ AI ጠይቅ' : language === 'om' ? 'Digaf AI Gaafadhu' : 'Ask Digaf AI'}
          </span>
        </button>
      </div>

      {/* 2. DRAWER OVERLAY & PANEL ROUTER */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-3xs animate-fade-in" id="ai_drawer_modal">
          <div className="flex-1" onClick={() => setIsOpen(false)} />

          <div className="w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl relative animate-slide-in">
            {/* Header branding block */}
            <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1 bg-linear-to-tr from-[#8B5CF6] to-[#C4B5FD] rounded-lg">
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-1 font-sans">
                    {language === 'am' ? 'የዲጋፍ ኤአይ ክንውን ረዳት' : language === 'om' ? 'Digaf AI Copilot' : 'Digaf Operations Copilot'}
                    <span className="text-[7.5px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-1 py-0.2 rounded font-bold uppercase tracking-widest leading-none ml-1">Live DB Connected</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">Real-time credit analysis assistant</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-800 p-0.5 rounded-md border border-slate-700">
                  <button
                    onClick={() => { setLanguage('en'); soundService.playSuccessChime(); }}
                    className={`px-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer border-none h-4.5 ${
                      language === 'en'
                        ? 'bg-slate-100 text-slate-950 font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => { setLanguage('am'); soundService.playSuccessChime(); }}
                    className={`px-1 rounded text-[8px] font-black tracking-wide transition-all cursor-pointer border-none h-4.5 ${
                      language === 'am'
                        ? 'bg-[#8B5CF6] text-white font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    አማ
                  </button>
                  <button
                    onClick={() => { setLanguage('om'); soundService.playSuccessChime(); }}
                    className={`px-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer border-none h-4.5 ${
                      language === 'om'
                        ? 'bg-amber-600 text-white font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    OM
                  </button>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/15 transition cursor-pointer border-none flex items-center justify-center"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Premium Dual Tabs */}
            {isGlobalEnabled && (
              <div className="flex border-b border-slate-200 bg-slate-100 p-1 font-sans">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer select-none border-none ${
                    activeTab === 'chat'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  💬 Chat Copilot
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('image'); soundService.playSuccessChime(); }}
                  className={`flex-1 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer select-none border-none ${
                    activeTab === 'image'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  ✨ {language === 'am' ? 'ዲጋፍ ስማርት ውል አራሚ' : language === 'om' ? 'Auditor Digaf' : 'Digaf Smart Auditor'}
                </button>
              </div>
            )}

            {/* Tab Contents: 1. Chat flow */}
            {activeTab === 'chat' && (
              <>
                {isChatAllowed ? (
                  <>
                    <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 scrollbar-thin">
                      {messages.map((m) => {
                        const isAI = m.sender === 'assistant';
                        return (
                          <div key={m.id} className={`flex gap-2.5 max-w-[88%] ${isAI ? 'self-start mr-auto' : 'self-end ml-auto flex-row-reverse'}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              isAI 
                                ? 'bg-indigo-50 border-indigo-150 text-[#8B5CF6]' 
                                : 'bg-slate-200 border-slate-300 text-slate-700'
                            }`}>
                              {isAI ? <Bot className="w-3.5 h-3.5" /> : <span className="text-[10px] font-black uppercase leading-none">{currentUser.fullName.charAt(0)}</span>}
                            </div>

                            <div className="space-y-1 w-full">
                              <div className={`p-3 rounded-2xl text-[11px] leading-relaxed break-words whitespace-pre-line border shadow-3xs ${
                                isAI 
                                  ? 'bg-white border-slate-150 text-slate-800 rounded-tl-none' 
                                  : 'bg-[#8B5CF6] border-violet-100 text-white rounded-tr-none font-medium'
                              }`}>
                                {m.text}
                              </div>
                              
                              <div className="flex items-center justify-between px-1">
                                <div>
                                  {isAI && m.id !== 'welcome-msg' && (
                                    <AIExportButton
                                      title={`Digaf AI - Report ${m.id}`}
                                      textRaw={m.text}
                                      metadata={{ officer: currentUser.fullName, context: 'AI Chat' }}
                                      size="xs"
                                      isZewdneh={isZewdneh}
                                    />
                                  )}
                                </div>
                                <span className="text-[8px] text-slate-400 font-mono text-right shrink-0">
                                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {loading && (
                        <div className="flex gap-2.5 max-w-[80%] self-start mr-auto">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-150 flex items-center justify-center text-[#8B5CF6]">
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                          </div>
                          <div className="p-3 bg-white border border-slate-150 rounded-2xl rounded-tl-none text-[11px] text-slate-500 font-bold italic flex items-center gap-1.5 shadow-3xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce [animation-delay:0.2s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-bounce [animation-delay:0.4s]" />
                            {language === 'am' ? 'ዲጋፍ ኤአይ መረጃዎችን በመገምገም ላይ ነው...' : language === 'om' ? 'Digaf AI galmeewwan dhiheessa xinxalaa jira...' : 'Digaf AI is auditing records...'}
                          </div>
                        </div>
                      )}

                      <div ref={bottomRef} />
                    </div>

                    {/* Quick Prompts Helper Box */}
                    <div className="p-3 bg-white border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between select-none">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">
                          {language === 'am' ? 'ፈጣን ጥያቄዎች' : language === 'om' ? 'Gaaffilee Saffisaa' : 'Quick operations queries'}
                        </span>
                        {messages.length > 1 && (
                          <button
                            type="button"
                            onClick={handleResetChat}
                            className="text-[8.2px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-700 hover:underline cursor-pointer border-none bg-transparent"
                          >
                            {language === 'am' ? 'ታሪክ አጥፋ' : language === 'om' ? 'Seenaa Haqii' : 'Clear talk memory'}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 select-none">
                        {quickActions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(action.text)}
                            disabled={loading}
                            className="p-1 px-2.5 bg-slate-50 text-[10px] text-slate-700 hover:text-slate-900 font-bold hover:bg-slate-100/80 hover:border-slate-350 border border-slate-200 rounded-lg shrink-0 flex items-center gap-1 transition-all cursor-pointer active:scale-95 text-left leading-normal disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ArrowRight className="w-3 h-3 text-[#8B5CF6] shrink-0" />
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bottom input area */}
                    <div className="p-3 border-t border-slate-200 bg-slate-50">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendMessage();
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          required
                          value={inputVal}
                          onChange={(e) => setInputVal(e.target.value)}
                          disabled={loading}
                          placeholder={language === 'am' ? "ዲጋፍ ኤአይ-ን ይጠይቁ..." : language === 'om' ? "Digaf AI Gaafadhu... " : "Ask Digaf AI..."}
                          className="flex-1 bg-white border border-slate-250 rounded-xl p-2.5 text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#8B5CF6] text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-3xs"
                        />
                        
                        <button
                          type="submit"
                          disabled={!inputVal.trim() || loading}
                          className="p-2.5 bg-[#8B5CF6] text-white hover:bg-[#7C3AED] rounded-xl cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed active:scale-95 transition-all shadow-md shrink-0 flex items-center justify-center"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 text-center font-sans space-y-4">
                    <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-150 flex items-center justify-center text-rose-500 animate-pulse">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div className="space-y-2 max-w-xs">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">AI Chat Suspended</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                        Access to the Chat Copilot has been suspended or revoked for your profile by the supervisor. Please contact management for access clearance.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Tab Contents: 2. Canva Contract Smart Editor */}
            {activeTab === 'image' && (
              <div className="flex-1 flex flex-col p-4 bg-slate-50 overflow-y-auto scrollbar-thin font-sans space-y-4">
                
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 font-sans">
                        <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                        Digaf Auto-Fill & Date Editor
                      </h4>
                      <p className="text-[9.5px] text-slate-500 leading-normal font-medium font-sans">
                        Calculate dates, correct omissions, or re-edit service charges.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-[10px]">
                    <label className="w-full p-3.5 bg-white hover:bg-slate-50 text-slate-700 font-extrabold rounded-lg border border-slate-200 text-center cursor-pointer transition-all active:scale-95 leading-snug flex flex-col items-center justify-center gap-0.5 relative">
                      <span>📂 Upload Custom Scan</span>
                      <span className="text-[8px] text-slate-400 font-medium font-sans">Pick contract photo/PDF</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadedFileName(file.name);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            soundService.playSuccessChime();
                            setUploadedImage(reader.result as string);
                            setBorrowerName('Evaluating...');
                            setSignedDate('Evaluating...');
                            setDueDate('');
                            setAuditResult(null);
                            setIsDigitizedSuccessfully(false);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {uploadedImage && (
                    <div className="p-2 bg-indigo-50 border border-indigo-150 rounded-lg flex items-center justify-between text-[9px] font-semibold text-indigo-850">
                      <span className="truncate max-w-[200px]">Custom document upload is active. Ready to run AI OCR.</span>
                      <button
                        onClick={() => { setUploadedImage(null); setUploadedFileName(null); soundService.playSuccessChime(); }}
                        className="text-rose-500 font-bold hover:underline bg-transparent border-none cursor-pointer text-[8px]"
                      >
                        Reset to Sample
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => triggerContractAudit()}
                    disabled={analyzingDoc}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-black uppercase text-[10px] tracking-wider rounded-lg shadow-sm transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {analyzingDoc ? (
                      <>
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                        Scanning and filling omissions...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#C4B5FD]" />
                        ⚡ Run AI Audit & Fill Omissions
                      </>
                    )}
                  </button>
                </div>

                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest px-1 font-sans">
                  Digaf Image Comparison View
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-3xs flex flex-col space-y-2">
                    <div className="flex items-center justify-between text-[8px] font-black uppercase text-rose-500 tracking-wider">
                      <span>Left Side: Original Scan</span>
                      <span className="bg-rose-50 px-1.5 py-0.5 rounded font-sans leading-none">[Omission Detected]</span>
                    </div>
                    
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 relative flex items-center justify-center p-2 min-h-[300px]">
                      {uploadedImage ? (
                        <img 
                          src={uploadedImage} 
                          alt="Original Digaf Contract" 
                          referrerPolicy="no-referrer"
                          className="max-h-[360px] object-contain w-full select-none"
                        />
                      ) : (
                        <div className="text-center p-4 space-y-2">
                          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
                          <span className="text-[10px] text-slate-400 block font-bold">No Custom Document Scanned</span>
                          <span className="text-[8px] text-slate-400 block leading-normal font-sans">
                            Using Digaf 1-Month Loan standard mock agreement pattern showing blank maturity terms.
                          </span>
                        </div>
                      )}
                      
                      <div className="absolute top-2 right-2 bg-rose-600/90 text-white font-extrabold text-[7.5px] uppercase tracking-widest px-2 py-0.5 rounded shadow-sm font-sans">
                        ⚠️ Pay Date Missing
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-3xs flex flex-col space-y-2">
                    <div className="flex items-center justify-between font-sans">
                      <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-emerald-600 tracking-wider">
                        <span>Right Side: Edited Image</span>
                        <span className="bg-emerald-50 px-1.5 py-0.5 rounded font-sans leading-none">✨ AI Filled</span>
                      </div>
                      
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 select-none">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Zoom</span>
                        {[1.0, 1.4, 1.8, 2.2].map((scale) => (
                          <button
                            key={scale}
                            type="button"
                            onClick={() => {
                              setZoomScale(scale);
                              soundService.playSuccessChime();
                            }}
                            className={`px-1.5 py-0.5 rounded font-mono text-[8px] font-bold transition-all cursor-pointer border-none ${
                              zoomScale === scale 
                                ? 'bg-indigo-600 text-white shadow-3xs font-extrabold' 
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                            }`}
                          >
                            {scale * 100}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`border border-slate-200 rounded-lg overflow-auto bg-slate-50 relative p-2 min-h-[300px] max-h-[380px] scrollbar-thin ${
                      zoomScale === 1.0 ? 'flex items-center justify-center' : 'block text-center'
                    }`}>
                      {editedImageSrc ? (
                        <div 
                          className="relative touch-none select-none cursor-crosshair inline-block transition-all shrink-0"
                          style={{
                            width: `${zoomScale * 100}%`,
                            minWidth: `${zoomScale * 100}%`,
                          }}
                          onPointerDown={handlePointerDown}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUpOrLeave}
                          onPointerLeave={handlePointerUpOrLeave}
                        >
                          <img 
                            src={editedImageSrc} 
                            alt="AI Edited Digaf Contract" 
                            referrerPolicy="no-referrer"
                            className="w-full object-contain select-none shadow-sm pointer-events-none block"
                          />

                          <div 
                            className={`absolute pointer-events-none border-2 border-dashed ${
                              draggedElement === 'date' 
                                ? 'border-indigo-600 bg-indigo-500/15 ring-2 ring-indigo-500/10' 
                                : 'border-slate-500/40 bg-slate-500/5'
                            } rounded px-1.5 py-0.5 text-[8px] font-mono text-slate-900 font-extrabold shadow-sm flex items-center gap-1 z-10`}
                            style={{
                              left: `${textPercentX}%`,
                              top: `${textPercentY}%`,
                              transform: 'translate(-50%, -50%)',
                              transition: isDragging ? 'none' : 'all 0.08s ease-out'
                            }}
                          >
                            <span className="leading-none shrink-0">📅</span>
                            <span className="leading-none text-[8.5px] font-black">{dueDate || 'Date'}</span>
                          </div>

                          {uploadedImage && (
                            <div 
                              className={`absolute pointer-events-none border-2 border-dashed ${
                                draggedElement === 'eraser' 
                                  ? 'border-rose-600 bg-rose-500/20 ring-2 ring-rose-500/10' 
                                  : 'border-slate-500/30 bg-slate-500/5'
                              } rounded shadow-sm flex items-center justify-center z-10`}
                              style={{
                                left: `${erasePercentX}%`,
                                top: `${erasePercentY}%`,
                                width: `${erasePercentW}%`,
                                height: `${erasePercentH}%`,
                                transform: 'translate(-50%, -50%)',
                                transition: isDragging ? 'none' : 'all 0.08s ease-out'
                              }}
                            >
                              <span className="text-[7.5px] font-black uppercase text-rose-950 bg-white/80 px-1 py-0.2 rounded-xs leading-none border border-rose-200 block shadow-3xs">
                                🧼
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center p-4">
                          <Loader className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
                          <span className="text-[10px] text-slate-400 block font-bold">Rendering Overlay...</span>
                        </div>
                      )}
                      
                      {dueDate && (
                        <div className="absolute top-2 right-2 bg-emerald-600 text-white font-extrabold text-[7.5px] uppercase tracking-widest px-2 py-0.5 rounded shadow-sm animate-pulse font-sans z-20">
                          ✅ PAY DATE INSERTED
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-250 rounded-xl p-3.5 space-y-3 shadow-xs font-sans">
                  <div className="space-y-1.5">
                    <span className="text-[8.5px] font-black uppercase text-slate-400 block tracking-widest font-sans">
                      Download Result
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadAsFormat('jpg')}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-all font-sans border-none shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Edited Agreement (JPG)</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-150 pt-3">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!dueDate) {
                          alert('Maturity date is empty. Please run OCR or compute date first.');
                          return;
                        }
                        try {
                          await dbService.addCustomerWithContract({
                            name: borrowerName,
                            phoneNumber: phoneNumber || '0586248521',
                            status: 'Renewal Processing',
                            addedBy: currentUser.fullName || 'System',
                            evidenceImage: uploadedImage || '',
                            loanAmount: loanAmount,
                            serviceFee: serviceFee,
                            interestRate: interestRate,
                            contractSignedDate: signedDate,
                            contractDueDate: dueDate,
                            isStampAffixed: isStampAffixed,
                            isSignatureAffixed: isSignatureAffixed
                          });

                          soundService.playSuccessChime();
                          setIsDigitizedSuccessfully(true);

                          await dbService.addAIUsageLog(
                            currentUser.fullName,
                            currentUser.phoneNumber,
                            'DIGITIZE_RENEWAL',
                            `Inject active portfolio dossier ${borrowerName} with computed pay date: ${dueDate}`
                          );
                        } catch (err: any) {
                          alert('Database Save Failure: ' + err.message);
                        }
                      }}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border-none"
                    >
                      <Save className="w-4 h-4" />
                      Save & Inject into Active Ledger
                    </button>
                  </div>

                  {isDigitizedSuccessfully && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-8 flex items-start gap-2 animate-fade-in font-medium">
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <strong className="block text-[10px] uppercase tracking-wider text-emerald-900 font-black">
                          Injected successfully!
                        </strong>
                        <p className="text-[9px] leading-snug">
                          The contract folder for <strong className="font-extrabold">{borrowerName}</strong> has been audited, digitised and successfully recorded. Real-time repayment scheduled for <strong className="font-extrabold text-indigo-755">{dueDate}</strong> based on the microfinance contract parameters.
                        </p>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}