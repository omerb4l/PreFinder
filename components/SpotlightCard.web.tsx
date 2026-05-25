import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import './SpotlightCard.css';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  style?: any;
  spotlightColor?: string;
}

export default function SpotlightCard({
  children,
  className = '',
  style = {},
  spotlightColor = 'rgba(0, 255, 135, 0.12)' // Premium glowing green matching PreFinder identity
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    divRef.current.style.setProperty('--mouse-x', `${x}px`);
    divRef.current.style.setProperty('--mouse-y', `${y}px`);
    divRef.current.style.setProperty('--spotlight-color', spotlightColor);
  };

  // Flatten React Native styles to extract visual card configurations
  const flatStyle = StyleSheet.flatten(style) || {};
  const cardBg = flatStyle.backgroundColor || '#1F2326';
  const borderRadius = flatStyle.borderRadius ?? 12;
  const borderColor = flatStyle.borderColor || 'rgba(255,255,255,0.05)';
  const borderWidth = flatStyle.borderWidth ?? 1;

  // We remove card backgrounds/borders from the inner View container so they don't block the spotlight gradient
  const innerStyle = {
    ...flatStyle,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`card-spotlight ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: cardBg,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        borderWidth: typeof borderWidth === 'number' ? `${borderWidth}px` : borderWidth,
        borderColor: borderColor,
        borderStyle: 'solid',
        display: 'flex',
        flexDirection: 'column',
        width: flatStyle.width || '100%',
        height: flatStyle.height,
        marginTop: flatStyle.marginTop,
        marginBottom: flatStyle.marginBottom,
        marginLeft: flatStyle.marginLeft,
        marginRight: flatStyle.marginRight,
      }}
    >
      <View style={innerStyle}>
        {children}
      </View>
    </div>
  );
}
