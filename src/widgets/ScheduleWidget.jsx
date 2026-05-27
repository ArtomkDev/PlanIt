import React from 'react';
import { FlexWidget, TextWidget, SvgWidget, ListWidget } from 'react-native-android-widget';
import { parseRealSchedule } from './scheduleCore';

const BASE_WIDTH = 320;
const BASE_HEIGHT = 400;

const ICON_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="24" d="M160 208L80 128l80-80"/></svg>`;
const ICON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="24" d="M96 208l80-80-80-80"/></svg>`;
const ICON_SCHEDULE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="176" height="176" x="40" y="40" fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" rx="16"/><path fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" d="M176 24v32M80 24v32M40 88h176"/></svg>`;
const ICON_COFFEE_TEMPLATE = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" d="M88 24v56M128 24v56M168 24v56"/><path fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" d="M72 104h112v88a24 24 0 01-24 24H96a24 24 0 01-24-24z"/><path fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" d="M184 136h24a24 24 0 0124 24v8a24 24 0 01-24 24h-24"/></svg>`;

function buildScale(width, height) {
  const w = width > 0 ? width : BASE_WIDTH;
  const h = height > 0 ? height : BASE_HEIGHT;
  const s = Math.min(w / BASE_WIDTH, h / BASE_HEIGHT);
  return (base) => Math.max(1, Math.round(base * s));
}

export function ScheduleWidget({ schedule, dateOffset = 0, width, height }) {
  const sc = buildScale(width || 0, height || 0);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dateOffset);

  const daysUk = ['Нд', 'Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб'];
  const monthsUk = [
    'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
  ];

  const { items, currentWeekNum, totalWeeks } = parseRealSchedule(schedule, targetDate, dateOffset);

  const headerText =
    dateOffset === 0 ? 'Сьогодні' : dateOffset === 1 ? 'Завтра' : daysUk[targetDate.getDay()];
  const dateInfo = `${targetDate.getDate()} ${monthsUk[targetDate.getMonth()]}${
    totalWeeks > 1 ? ` • Тиждень ${currentWeekNum}` : ''
  }`;
  const isTodayActive = dateOffset === 0;

  const hPad = sc(16);
  const borderRadius = sc(24);
  const paddingTop = sc(16);
  const headerMarginBottom = sc(12);
  const headerIconSize = sc(18);
  const headerIconPad = sc(10);
  const headerIconRadius = sc(12);
  const headerIconMarginRight = sc(8);
  const headerFontBig = sc(20);
  const headerFontSmall = sc(12);
  const navHeight = sc(48);
  const navRadius = sc(14);
  const navPadBottom = sc(16);
  const navPadTop = sc(8);
  const navMarginRight = sc(6);
  const navFontSize = sc(14);
  const navIconSize = sc(22);
  const stripW = sc(4);
  const stripMarginV = sc(10);
  const stripMarginL = sc(16);
  const stripRadius = sc(4);
  const lessonPadV = sc(12);
  const lessonPadL = sc(12);
  const lessonPadR = sc(16);
  const lessonMarginB = sc(8);
  const lessonMarginRight = sc(8);
  const lessonFontTitle = sc(15);
  const lessonFontSub = sc(12);
  const lessonTitleMarginB = sc(2);
  const badgePadH = sc(8);
  const badgePadV = sc(4);
  const badgeRadius = sc(8);
  const badgeFont = sc(12);
  const breakPadV = sc(10);
  const breakPadL = sc(12);
  const breakPadR = sc(16);
  const breakMarginB = sc(8);
  const breakStripMarginV = sc(12);
  const breakStripMarginB = sc(4);
  const breakIconSize = sc(14);
  const breakIconMarginR = sc(6);
  const breakFontTitle = sc(13);
  const breakFontTime = sc(11);
  const emptyFont = sc(15);
  const noSchFont = sc(16);
  const noSchBtnPadH = sc(16);
  const noSchBtnPadV = sc(10);
  const noSchBtnRadius = sc(12);
  const noSchBtnFont = sc(13);
  const noSchMarginB = sc(12);

  const RootContainer = ({ children }) => (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#121214',
        borderRadius: borderRadius,
        paddingTop: paddingTop,
        flexDirection: 'column',
      }}
    >
      {children}
    </FlexWidget>
  );

  if (!schedule) {
    return (
      <RootContainer>
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            height: 'match_parent',
            justifyContent: 'center',
            alignItems: 'center',
            paddingBottom: hPad,
            paddingHorizontal: hPad,
          }}
        >
          <TextWidget
            text="Виберіть розклад"
            style={{ color: '#FFFFFF', fontSize: noSchFont, fontWeight: 'bold', marginBottom: noSchMarginB }}
          />
          <FlexWidget
            clickAction="OPEN_SCHEDULE_SELECTOR"
            style={{
              backgroundColor: '#0A84FF',
              paddingHorizontal: noSchBtnPadH,
              paddingVertical: noSchBtnPadV,
              borderRadius: noSchBtnRadius,
            }}
          >
            <TextWidget
              text="Відкрити налаштування"
              style={{ color: '#FFFFFF', fontSize: noSchBtnFont, fontWeight: '600' }}
            />
          </FlexWidget>
        </FlexWidget>
      </RootContainer>
    );
  }

  return (
    <RootContainer>
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: headerMarginBottom,
          paddingHorizontal: hPad,
        }}
      >
        <FlexWidget style={{ flexDirection: 'column', flex: 1, marginRight: headerIconMarginRight, flexShrink: 1 }}>
          <TextWidget
            text={headerText}
            style={{ color: '#FFFFFF', fontSize: headerFontBig, fontWeight: 'bold' }}
            maxLines={1}
          />
          <TextWidget
            text={dateInfo}
            style={{ color: '#8E8E93', fontSize: headerFontSmall }}
            maxLines={1}
          />
        </FlexWidget>

        <FlexWidget
          clickAction="OPEN_SCHEDULE_SELECTOR"
          style={{
            padding: headerIconPad,
            backgroundColor: '#242426',
            borderRadius: headerIconRadius,
            flexShrink: 0,
          }}
        >
          <SvgWidget svg={ICON_SCHEDULE} style={{ width: headerIconSize, height: headerIconSize }} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
        {items.length > 0 ? (
          <ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
            {items.map((item, idx) => {
              if (item.type === 'lesson') {
                return (
                  <FlexWidget
                    key={`lesson-${idx}`}
                    clickAction="OPEN_LESSON"
                    clickActionData={{ targetDateStr: targetDate.toISOString(), lessonIndex: item.lessonIndex }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'stretch',
                      backgroundColor: item.isCurrent ? '#2C2C2E' : '#1C1C1E',
                      marginBottom: lessonMarginB,
                      width: 'match_parent',
                      borderRadius: 0,
                    }}
                  >
                    <FlexWidget
                      style={{
                        width: stripW,
                        height: 'match_parent',
                        backgroundColor: item.color,
                        marginTop: stripMarginV,
                        marginBottom: stripMarginV,
                        marginLeft: stripMarginL,
                        borderRadius: stripRadius,
                      }}
                    />

                    <FlexWidget
                      style={{
                        flexDirection: 'row',
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: lessonPadV,
                        paddingLeft: lessonPadL,
                        paddingRight: lessonPadR,
                      }}
                    >
                      <FlexWidget
                        style={{
                          flexDirection: 'column',
                          flex: 1,
                          marginRight: item.isCurrent ? lessonMarginRight : 0,
                        }}
                      >
                        <TextWidget
                          text={`${item.lessonIndex + 1}. ${item.subject}`}
                          style={{ color: '#FFFFFF', fontSize: lessonFontTitle, fontWeight: '700', marginBottom: lessonTitleMarginB }}
                          maxLines={1}
                        />
                        <TextWidget
                          text={`${item.startTime} - ${item.endTime} • ${item.details}`}
                          style={{ color: '#8E8E93', fontSize: lessonFontSub }}
                          maxLines={1}
                        />
                      </FlexWidget>

                      {item.isCurrent && (
                        <FlexWidget
                          style={{
                            backgroundColor: '#32D74B20',
                            paddingHorizontal: badgePadH,
                            paddingVertical: badgePadV,
                            borderRadius: badgeRadius,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <TextWidget
                            text={`${item.minutesLeft} хв`}
                            style={{ color: '#32D74B', fontSize: badgeFont, fontWeight: 'bold' }}
                          />
                        </FlexWidget>
                      )}
                    </FlexWidget>
                  </FlexWidget>
                );
              }

              if (item.type === 'break') {
                const breakIconColor = item.isCurrent ? item.color : '#8E8E93';
                const breakTextColor = item.isCurrent ? '#FFFFFF' : '#8E8E93';
                const breakBgColor = item.isCurrent ? '#2C2C2E' : '#121214';
                const stripColor = item.isCurrent ? item.color : '#48484A';

                return (
                  <FlexWidget
                    key={`break-${idx}`}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: breakBgColor,
                      marginBottom: breakMarginB,
                      width: 'match_parent',
                      alignItems: 'stretch',
                      borderRadius: 0,
                    }}
                  >
                    <FlexWidget
                      style={{
                        width: stripW,
                        height: 'match_parent',
                        marginLeft: stripMarginL,
                        marginTop: breakStripMarginV,
                        marginBottom: breakStripMarginV,
                        flexDirection: 'column',
                      }}
                    >
                      <FlexWidget
                        style={{ width: stripW, flex: 1, backgroundColor: stripColor, borderRadius: stripRadius, marginBottom: breakStripMarginB }}
                      />
                      <FlexWidget
                        style={{ width: stripW, flex: 1, backgroundColor: stripColor, borderRadius: stripRadius }}
                      />
                    </FlexWidget>

                    <FlexWidget
                      style={{
                        paddingVertical: breakPadV,
                        paddingLeft: breakPadL,
                        paddingRight: breakPadR,
                        flex: 1,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <FlexWidget
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: lessonMarginRight }}
                      >
                        <SvgWidget
                          svg={ICON_COFFEE_TEMPLATE(breakIconColor)}
                          style={{ width: breakIconSize, height: breakIconSize, marginRight: breakIconMarginR }}
                        />
                        <TextWidget
                          text={`Перерва ${item.duration} хв`}
                          style={{ color: breakTextColor, fontSize: breakFontTitle, fontWeight: '600' }}
                          maxLines={1}
                        />
                      </FlexWidget>
                      <TextWidget
                        text={`${item.startTime} - ${item.endTime}`}
                        style={{ color: '#8E8E93', fontSize: breakFontTime }}
                        maxLines={1}
                      />
                    </FlexWidget>
                  </FlexWidget>
                );
              }

              return null;
            })}
          </ListWidget>
        ) : (
          <FlexWidget
            style={{ flex: 1, width: 'match_parent', height: 'match_parent', justifyContent: 'center', alignItems: 'center' }}
          >
            <TextWidget text="Пар немає 🎉" style={{ color: '#8E8E93', fontSize: emptyFont }} />
          </FlexWidget>
        )}
      </FlexWidget>

      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          paddingBottom: navPadBottom,
          paddingTop: navPadTop,
          paddingHorizontal: hPad,
        }}
      >
        <FlexWidget
          clickAction="PREV_DAY"
          style={{
            flex: 1,
            height: navHeight,
            backgroundColor: '#242426',
            borderRadius: navRadius,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: navMarginRight,
          }}
        >
          <SvgWidget svg={ICON_LEFT} style={{ width: navIconSize, height: navIconSize }} />
        </FlexWidget>

        <FlexWidget
          {...(isTodayActive ? {} : { clickAction: 'TODAY' })}
          style={{
            flex: 2,
            height: navHeight,
            backgroundColor: '#242426',
            borderRadius: navRadius,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: navMarginRight,
          }}
        >
          <TextWidget
            text="Сьогодні"
            style={{ color: isTodayActive ? '#8E8E93' : '#FFFFFF', fontSize: navFontSize, fontWeight: 'bold' }}
            maxLines={1}
          />
        </FlexWidget>

        <FlexWidget
          clickAction="NEXT_DAY"
          style={{
            flex: 1,
            height: navHeight,
            backgroundColor: '#242426',
            borderRadius: navRadius,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SvgWidget svg={ICON_RIGHT} style={{ width: navIconSize, height: navIconSize }} />
        </FlexWidget>
      </FlexWidget>
    </RootContainer>
  );
}
