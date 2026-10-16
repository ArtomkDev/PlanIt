import React from 'react';
import { useColorScheme } from 'react-native';
import { useScheduleData } from '../../context/ScheduleProvider';
import themes from '../../config/themes';

export default function WebThemeStyles() {
  const { global } = useScheduleData();
  const systemScheme = useColorScheme();
  const [setting = systemScheme || 'light', accent = 'blue'] = global?.theme || [];
  const mode = setting === 'system' ? systemScheme || 'light' : setting;
  const colors = themes.getColors(mode, accent);

  return <style>{`
    :root {
      color-scheme: ${mode === 'dark' || mode === 'oled' ? 'dark' : 'light'};
      --planit-scrollbar-thumb: ${colors.textColor3};
      --planit-scrollbar-thumb-hover: ${colors.textColor2};
    }
    * {
      --planit-scrollbar-top: 0px;
      --planit-scrollbar-bottom: 0px;
    }
    @media (forced-colors: none) {
      *::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      *::-webkit-scrollbar-track, *::-webkit-scrollbar-corner {
        background: transparent;
      }
      *::-webkit-scrollbar-track:vertical {
        margin-top: var(--planit-scrollbar-top);
        margin-bottom: var(--planit-scrollbar-bottom);
      }
      *::-webkit-scrollbar-thumb {
        background-color: var(--planit-scrollbar-thumb);
        background-clip: padding-box;
        border: 2px solid transparent;
        border-radius: 10px;
        min-height: 40px;
      }
      *::-webkit-scrollbar-thumb:hover {
        background-color: var(--planit-scrollbar-thumb-hover);
      }
      *::-webkit-scrollbar-button {
        display: none;
      }
      @supports not selector(::-webkit-scrollbar) {
        * {
          scrollbar-width: thin;
          scrollbar-color: var(--planit-scrollbar-thumb) transparent;
        }
      }
    }
  `}</style>;
}
