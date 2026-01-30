import { NavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import React from 'react';

export const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

