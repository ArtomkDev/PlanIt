import React from 'react';
import useAppTheme from '../../hooks/useAppTheme';

export default function WebThemeStyles() {
  const { colorScheme, colors } = useAppTheme();

  return <>
    <meta name="theme-color" content={colors.backgroundColor} />
    <style>{`
    :root {
      color-scheme: ${colorScheme};
      --planit-scrollbar-thumb: ${colors.textColor3};
      --planit-scrollbar-thumb-hover: ${colors.textColor2};
    }
    html, body {
      background-color: ${colors.backgroundColor};
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
    `}</style>
  </>;
}
