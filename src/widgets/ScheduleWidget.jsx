import React from 'react';
import { FlexWidget, TextWidget, SvgWidget, ListWidget } from 'react-native-android-widget';
import { parseRealSchedule } from './scheduleCore';

const ICON_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="24" d="M160 208L80 128l80-80"/></svg>`;
const ICON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="24" d="M96 208l80-80-80-80"/></svg>`;
const ICON_SCHEDULE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="176" height="176" x="40" y="40" fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" rx="16"/><path fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" d="M176 24v32M80 24v32M40 88h176"/></svg>`;
const ICON_COFFEE_TEMPLATE = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" d="M88 24v56M128 24v56M168 24v56"/><path fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" d="M72 104h112v88a24 24 0 01-24 24H96a24 24 0 01-24-24z"/><path fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="20" d="M184 136h24a24 24 0 0124 24v8a24 24 0 01-24 24h-24"/></svg>`;

export function ScheduleWidget({ schedule, dateOffset = 0 }) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dateOffset);
  
  const daysUk = ['Нд', 'Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб'];
  const monthsUk = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  
  const { items, currentWeekNum, totalWeeks } = parseRealSchedule(schedule, targetDate, dateOffset);
  
  const headerText = dateOffset === 0 ? "Сьогодні" : (dateOffset === 1 ? "Завтра" : daysUk[targetDate.getDay()]);
  const dateInfo = `${targetDate.getDate()} ${monthsUk[targetDate.getMonth()]}${totalWeeks > 1 ? ` • Тиждень ${currentWeekNum}` : ''}`;
  const isTodayActive = dateOffset === 0;

  const RootContainer = ({ children }) => (
    <FlexWidget style={{ 
      height: 'match_parent', 
      width: 'match_parent', 
      backgroundColor: '#121214', 
      borderRadius: 24, 
      paddingTop: 16, 
      flexDirection: 'column' 
    }}>
      {children}
    </FlexWidget>
  );

  if (!schedule) {
    return (
      <RootContainer>
        <FlexWidget style={{ flex: 1, width: 'match_parent', height: 'match_parent', justifyContent: 'center', alignItems: 'center', paddingBottom: 16, paddingHorizontal: 16 }}>
          <TextWidget text="Виберіть розклад" style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }} />
          <FlexWidget 
            clickAction="OPEN_SCHEDULE_SELECTOR" 
            style={{ backgroundColor: '#0A84FF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
          >
            <TextWidget text="Відкрити налаштування" style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }} />
          </FlexWidget>
        </FlexWidget>
      </RootContainer>
    );
  }

  return (
    <RootContainer>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 }}>
        <FlexWidget style={{ flexDirection: 'column', flex: 1, marginRight: 8, flexShrink: 1 }}>
          <TextWidget text={headerText} style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }} maxLines={1} />
          <TextWidget text={dateInfo} style={{ color: '#8E8E93', fontSize: 12 }} maxLines={1} />
        </FlexWidget>

        <FlexWidget clickAction="OPEN_SCHEDULE_SELECTOR" style={{ padding: 10, backgroundColor: '#242426', borderRadius: 12, flexShrink: 0 }}>
          <SvgWidget svg={ICON_SCHEDULE} style={{ width: 18, height: 18 }} />
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
                      marginBottom: 8, 
                      width: 'match_parent',
                      borderRadius: 0, 
                    }}
                  >
                    <FlexWidget 
                      style={{ 
                        width: 4, 
                        height: 'match_parent',
                        backgroundColor: item.color, 
                        marginTop: 10,
                        marginBottom: 10,
                        marginLeft: 16, 
                        borderRadius: 4, 
                      }} 
                    />
                    
                    <FlexWidget style={{ flexDirection: 'row', flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingLeft: 12, paddingRight: 16 }}>
                      <FlexWidget style={{ flexDirection: 'column', flex: 1, marginRight: item.isCurrent ? 8 : 0 }}>
                        <TextWidget text={`${item.lessonIndex + 1}. ${item.subject}`} style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 }} maxLines={1} />
                        <TextWidget text={`${item.startTime} - ${item.endTime} • ${item.details}`} style={{ color: '#8E8E93', fontSize: 12 }} maxLines={1} />
                      </FlexWidget>

                      {item.isCurrent && (
                        <FlexWidget style={{ backgroundColor: '#32D74B20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
                          <TextWidget text={`${item.minutesLeft} хв`} style={{ color: '#32D74B', fontSize: 12, fontWeight: 'bold' }} />
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
                      marginBottom: 8,
                      width: 'match_parent',
                      alignItems: 'stretch',
                      borderRadius: 0,
                    }}
                  >
                    <FlexWidget style={{ 
                      width: 4, 
                      height: 'match_parent',
                      marginLeft: 16, 
                      marginTop: 12, 
                      marginBottom: 12, 
                      flexDirection: 'column',
                    }}>
                      <FlexWidget style={{ width: 4, flex: 1, backgroundColor: stripColor, borderRadius: 4, marginBottom: 4 }} />
                      <FlexWidget style={{ width: 4, flex: 1, backgroundColor: stripColor, borderRadius: 4 }} />
                    </FlexWidget>

                    <FlexWidget style={{ paddingVertical: 10, paddingLeft: 12, paddingRight: 16, flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <SvgWidget svg={ICON_COFFEE_TEMPLATE(breakIconColor)} style={{ width: 14, height: 14, marginRight: 6 }} />
                        <TextWidget text={`Перерва ${item.duration} хв`} style={{ color: breakTextColor, fontSize: 13, fontWeight: '600' }} maxLines={1} />
                      </FlexWidget>
                      <TextWidget text={`${item.startTime} - ${item.endTime}`} style={{ color: '#8E8E93', fontSize: 11 }} maxLines={1} />
                    </FlexWidget>
                  </FlexWidget>
                );
              }
            })}
          </ListWidget>
        ) : (
          <FlexWidget style={{ flex: 1, width: 'match_parent', height: 'match_parent', justifyContent: 'center', alignItems: 'center' }}>
            <TextWidget text="Пар немає 🎉" style={{ color: '#8E8E93', fontSize: 15 }} />
          </FlexWidget>
        )}
      </FlexWidget>

      <FlexWidget style={{ 
        flexDirection: 'row', 
        width: 'match_parent', 
        paddingBottom: 16, 
        paddingTop: 8,
        paddingHorizontal: 16
      }}>
        <FlexWidget clickAction="PREV_DAY" style={{ flex: 1, height: 48, backgroundColor: '#242426', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
          <SvgWidget svg={ICON_LEFT} style={{ width: 22, height: 22 }} />
        </FlexWidget>
        
        <FlexWidget 
          {...(isTodayActive ? {} : { clickAction: "TODAY" })}
          style={{ flex: 2, height: 48, backgroundColor: '#242426', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 6 }}
        >
          <TextWidget text="Сьогодні" style={{ color: isTodayActive ? '#8E8E93' : '#FFFFFF', fontSize: 14, fontWeight: 'bold' }} maxLines={1} />
        </FlexWidget>
        
        <FlexWidget clickAction="NEXT_DAY" style={{ flex: 1, height: 48, backgroundColor: '#242426', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
          <SvgWidget svg={ICON_RIGHT} style={{ width: 22, height: 22 }} />
        </FlexWidget>
      </FlexWidget>

    </RootContainer>
  );
}