import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themes = {
  whatsappLight: {
    name: 'WhatsApp Light',
    bgApp: 'bg-[#d1d7db]',
    bgMain: 'bg-[#efeae2]',
    bgSidebar: 'bg-white',
    bgHeader: 'bg-[#f0f2f5]',
    textMain: 'text-[#111b21]',
    textMuted: 'text-[#54656f]',
    primary: 'bg-[#00a884]',
    bubbleOut: 'bg-[#d9fdd3]',
    bubbleIn: 'bg-white',
  },
  telegramNight: {
    name: 'Telegram Night',
    bgApp: 'bg-[#0f0f0f]',
    bgMain: 'bg-[#0f0f0f]',
    bgSidebar: 'bg-[#17212b]',
    bgHeader: 'bg-[#17212b]',
    textMain: 'text-white',
    textMuted: 'text-[#7f91a4]',
    primary: 'bg-[#3390ec]',
    bubbleOut: 'bg-[#2b5278]',
    bubbleIn: 'bg-[#182533]',
  },
  oledMatrix: {
    name: 'OLED Matrix',
    bgApp: 'bg-black',
    bgMain: 'bg-black',
    bgSidebar: 'bg-black',
    bgHeader: 'bg-[#0a0a0a]',
    textMain: 'text-[#00ff41]',
    textMuted: 'text-[#008f11]',
    primary: 'bg-[#003b00]',
    bubbleOut: 'bg-[#001a00]',
    bubbleIn: 'bg-[#0a0a0a]',
  }
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('whatsappLight');

  // Load saved theme from local storage
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  const changeTheme = (themeKey) => {
    setCurrentTheme(themeKey);
    localStorage.setItem('appTheme', themeKey);
  };

  return (
    <ThemeContext.Provider value={{ theme: themes[currentTheme], activeThemeKey: currentTheme, changeTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);