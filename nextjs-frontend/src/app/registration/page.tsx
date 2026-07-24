'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDynamicRegistration } from '@/app/hooks/useDynamicRegistration';
import { useMultipleToggleableRadio } from '@/app/hooks/useToggleableRadio';
import PayPalButtonFixed from '@/app/components/PayPalButtonFixed';
import PayPalButtonReliable from '@/app/components/PayPalButtonReliable';
import PayPalErrorBoundary from '@/app/components/PayPalErrorBoundary';
import RazorpayButton from '@/app/components/RazorpayButton';
import { CurrencyProvider } from '@/app/contexts/CurrencyContext';
import CurrencySelector from '@/app/components/CurrencySelector';
import { useCurrencyPricing } from '@/app/hooks/useCurrencyPricing';
import { getRegistrationSettingsWithFallback, RegistrationSettingsType } from '@/app/getRegistrationSettings';
import imageUrlBuilder from '@sanity/image-url';
import { client } from '@/app/sanity/client';
import { get } from 'http';
import { getHeroSection } from '../getHeroSection';
import HeroBlinkText from '../components/HeroBlinkText';

// Initialize the image URL builder
const builder = imageUrlBuilder(client);

// Helper function to generate image URLs
function urlFor(source: any) {
  return builder.image(source);
}


// Form data interface
interface FormData {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  country: string;
  fullPostalAddress: string;
  selectedRegistration: string;
  sponsorType: string;
  accommodationType: string;
  accommodationNights: string;
  numberOfParticipants: number;
  numberOfAccompanyingPersons: number;
  checkInDate: string;
  checkOutDate: string;
  currency?: string;
  institution: string;
}

// Countries list from reference site
const countries = [
  'Afghanistan', 'Albania', 'Algeria', 'American Samoa', 'Andorra', 'Angola', 'Anguilla', 'Antarctica',
  'Antigua and Barbuda', 'Argentina', 'Armenia', 'Aruba', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas',
  'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bermuda', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Bouvet Island', 'Brazil', 'British Indian Ocean Territory',
  'Brunei Darussalam', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
  'Cape Verde', 'Cayman Islands', 'Central African Republic', 'Chad', 'Chile', 'China', 'Christmas Island',
  'Cocos (Keeling) Islands', 'Colombia', 'Comoros', 'Congo', 'Cook Islands', 'Costa Rica', 'Croatia (Hrvatska)',
  'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Ethiopia',
  'Falkland Islands (Malvinas)', 'Faroe Islands', 'Fiji', 'Finland', 'France', 'France, Metropolitan',
  'French Guiana', 'French Polynesia', 'French Southern Territories', 'Gabon', 'Gambia', 'Georgia',
  'Germany', 'Ghana', 'Gibraltar', 'Guernsey', 'Greece', 'Greenland', 'Grenada', 'Guadeloupe', 'Guam',
  'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Heard and Mc Donald Islands', 'Honduras',
  'Hong Kong', 'Hungary', 'Iceland', 'India', 'Isle of Man', 'Indonesia', 'Iran (Islamic Republic of)',
  'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jersey', 'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'Korea, Democratic People\'s Republic of', 'Korea, Republic of',
  'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Lao People\'s Democratic Republic', 'Latvia', 'Lebanon', 'Lesotho',
  'Liberia', 'Libyan Arab Jamahiriya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macau', 'Macedonia',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Martinique',
  'Mauritania', 'Mauritius', 'Mayotte', 'Mexico', 'Micronesia, Federated States of', 'Moldova, Republic of',
  'Monaco', 'Mongolia', 'Montenegro', 'Montserrat', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru',
  'Nepal', 'Netherlands', 'Netherlands Antilles', 'New Caledonia', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'Niue', 'Norfolk Island', 'Northern Mariana Islands', 'Norway', 'Oman', 'Pakistan', 'Palau',
  'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Pitcairn', 'Poland',
  'Portugal', 'Puerto Rico', 'Qatar', 'Reunion', 'Romania', 'Russian Federation', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino',
  'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore',
  'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Georgia South Sandwich Islands',
  'Spain', 'Sri Lanka', 'St. Helena', 'St. Pierre and Miquelon', 'Sudan', 'Suriname',
  'Svalbard and Jan Mayen Islands', 'Swaziland', 'Sweden', 'Switzerland', 'Syrian Arab Republic', 'Taiwan',
  'Tajikistan', 'Tanzania, United Republic of', 'Thailand', 'Togo', 'Tokelau', 'Tonga', 'Trinidad and Tobago',
  'Tunisia', 'Turkey', 'Turkmenistan', 'Turks and Caicos Islands', 'Tuvalu', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'United States minor outlying islands', 'Uruguay',
  'Uzbekistan', 'Vanuatu', 'Vatican City State', 'Venezuela', 'Vietnam', 'Virgin Islands (British)',
  'Virgin Islands (U.S.)', 'Wallis and Futuna Islands', 'Western Sahara', 'Yemen', 'Zaire', 'Zambia', 'Zimbabwe'
];

function RegistrationPageContent() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [currentRegistrationId, setCurrentRegistrationId] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [currentPricingPeriod, setCurrentPricingPeriod] = useState<'earlyBird' | 'nextRound' | 'spotRegistration'>('earlyBird');
  const [registrationSettings, setRegistrationSettings] = useState<RegistrationSettingsType | null>(null);
  const [accommodationNights, setAccommodationNights] = useState<number>(0);
  // Conference date: June 23, 2025 - default to 3 days before
  const [checkInDate, setCheckInDate] = useState<string>('');
  const [checkOutDate, setCheckOutDate] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState<string | null>(null);
  const [conferenceData, setConferenceData] = useState<any | null>(null);

  // Dynamic registration data
  const {
    data: dynamicData,
    loading: dynamicLoading,
    error: dynamicError,
    refetch: refetchDynamicData,
    getCurrentPeriodPricing,
    isRegistrationOpen,
    getActivePeriodId,
  } = useDynamicRegistration();

  // Currency pricing hook
  const { selectedCurrency, formatPrice, getRegistrationPrice, getSponsorshipPrice, getAccommodationPrice, setSelectedCurrency, getAccompanyingPersonPrice } = useCurrencyPricing();

  // Fetch registration settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        // Try to fetch from API first
        const response = await fetch('/api/registration-settings');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.settings) {
            setRegistrationSettings(data.settings);
            return;
          }
        }

        // Fallback to direct function call
        const settings = await getRegistrationSettingsWithFallback();
        setRegistrationSettings(settings);
      } catch (error) {
        // Use default settings as fallback
        try {
          const defaultSettings = await getRegistrationSettingsWithFallback();
          setRegistrationSettings(defaultSettings);
        } catch (fallbackError) {
          // Silent fallback
        }
      }
    }
    fetchSettings();
    fetchConferenceTitle();
  }, []);

  async function fetchConferenceTitle() {
  try {
    console.log('🚀 Fetching hero section');
    const response = await fetch('/api/hero-section');

    if (!response.ok) {
      console.error('❌ Failed to fetch hero section:', response.statusText);
      throw new Error('Failed to fetch hero section');
    }

    const data = await response.json();
    console.log('✅ Hero section data:', data);

    setConferenceData(data);
    } catch (err) {
      console.error('❌ Error fetching hero section:', err);
    }
  } 

  useEffect(() => {
    if (conferenceData) {
      console.log('🎯 Hero section ready:', conferenceData);
    }
  }, [conferenceData]);


  //For check in checkout dates 
  useEffect(() => {
  if (registrationSettings?.conferenceDetails?.conferenceDate) {
    const conferenceDate = new Date(registrationSettings.conferenceDetails.conferenceDate);
    const defaultCheckIn = new Date(conferenceDate);
    defaultCheckIn.setDate(conferenceDate.getDate() - 3);
    
    const checkInStr = defaultCheckIn.toISOString().split('T')[0];
    
    setCheckInDate('');
    setCheckOutDate('');
    
    console.log('✅ Dates set from registration settings:', {
      conferenceDate: registrationSettings.conferenceDetails.conferenceDate,
      checkInDate: checkInStr
    });
  }
}, [registrationSettings]);



  // Enhanced radio button management
  const {
    handleRadioChange,
    clearSelection,
    isSelected,
    getSelection,
    resetAllSelections,
  } = useMultipleToggleableRadio({
    allowDeselect: true, // Enable deselection of radio buttons
    onSelectionChange: (groupName, value, previousValue) => {
      console.log(`Selection changed in ${groupName}: ${previousValue} → ${value}`);

      // Clear other selections when switching between regular and sponsorship
      if (groupName === 'registrationType' && value) {
        clearSelection('sponsorshipType');
      } else if (groupName === 'sponsorshipType' && value) {
        clearSelection('registrationType');
      }


      // ✅ Set default dates ONLY when accommodation is selected
      if (groupName === 'accommodation' && value) {
        if (registrationSettings?.conferenceDetails?.conferenceDate) {
          const conferenceDate = new Date(registrationSettings.conferenceDetails.conferenceDate);
          const defaultCheckIn = new Date(conferenceDate);
          defaultCheckIn.setDate(conferenceDate.getDate() - 3);
          const checkInStr = defaultCheckIn.toISOString().split('T')[0];
          setCheckInDate(checkInStr);
          setCheckOutDate(checkInStr);
        }
      }

      // ✅ Clear dates when accommodation is deselected
      if (groupName === 'accommodation' && !value) {
        setCheckInDate('');
        setCheckOutDate('');
      }

      // Clear registration ID when selection changes to force re-registration
      // This fixes the sponsorship reselection bug and ensures PayPal button reappears
      if (groupName === 'registrationType' || groupName === 'sponsorshipType' || groupName === 'accommodation') {
        if (currentRegistrationId) {
          console.log(`🔄 Clearing registration ID due to ${groupName} selection change`);
          setCurrentRegistrationId(null);
        }
      }
    },
    allowDeselect: true,
  });



  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    country: '',
    fullPostalAddress: '',
    selectedRegistration: '',
    sponsorType: '',
    accommodationType: '',
    accommodationNights: '',
    numberOfParticipants: 1,
    numberOfAccompanyingPersons: 0,
    checkInDate: '',
    checkOutDate: '',
    currency: '',
    institution: '',
  });

  // Handle input changes
  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Determine current pricing period based on dates
  useEffect(() => {
    const now = new Date();
    const earlyBirdEnd = new Date('2025-02-28');
    const nextRoundEnd = new Date('2025-05-31');

    if (now <= earlyBirdEnd) {
      setCurrentPricingPeriod('earlyBird');
    } else if (now <= nextRoundEnd) {
      setCurrentPricingPeriod('nextRound');
    } else {
      setCurrentPricingPeriod('spotRegistration');
    }
  }, []);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate
    }));
  }, [checkInDate, checkOutDate]);

  // Calculate accommodation nights automatically based on check-in and check-out dates
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);

      // Reset time parts to get accurate day difference
      checkIn.setHours(0, 0, 0, 0);
      checkOut.setHours(0, 0, 0, 0);

      const diffTime = checkOut.getTime() - checkIn.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Calculate nights: if selecting 3 days (20, 21, 22), that's 2 nights
      const numberOfNights = diffDays ;

      // Validate that check-out is after or equal to check-in
      if (diffDays < 0) {
        // If check-out is before check-in, reset
        setCheckOutDate(checkInDate);
        setAccommodationNights(1); // Single day = 1 night
      } else if (numberOfNights > 10) {
        // Maximum 10 nights allowed
        setAccommodationNights(10);
      } else {
        setAccommodationNights(numberOfNights);
      }
    } else {
      setAccommodationNights(0);
    }
  }, [checkInDate, checkOutDate]);

  // Calendar drag handlers
  const handleCalendarMouseDown = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    
    // Calculate dynamic min/max based on conference date
    const conferenceDate = new Date(registrationSettings?.conferenceDetails?.conferenceDate || '2026-06-23');
    const minDate = new Date(conferenceDate);
    minDate.setDate(conferenceDate.getDate() - 3);
    const maxDate = new Date(conferenceDate);
    maxDate.setDate(conferenceDate.getDate() + 3);
    
    console.log('🖱️ Mouse Down on:', dateStr, 'Current dragging state:', isDragging);
    
    if (date >= minDate && date <= maxDate) {
      if (!isDragging) {
        // First click - start dragging
        console.log('✅ Starting drag from:', dateStr);
        setIsDragging(true);
        setDragStartDate(dateStr);
        setCheckInDate(dateStr);
        setCheckOutDate(dateStr);
      } else {
        // Second click - end dragging
        console.log('🛑 Ending drag at:', dateStr);
        setIsDragging(false);
        setDragStartDate(null);
      }
    }
  }, [isDragging, registrationSettings]);

  const handleCalendarMouseEnter = useCallback((dateStr: string) => {
    console.log('🖱️ Mouse Enter on:', dateStr, 'isDragging:', isDragging, 'dragStart:', dragStartDate);
    
    // Only update selection if we're in drag mode (between first and second click)
    if (isDragging && dragStartDate) {
      const dragStart = new Date(dragStartDate);
      const currentDate = new Date(dateStr);
      
      // Calculate dynamic min/max based on conference date
      const conferenceDate = new Date(registrationSettings?.conferenceDetails?.conferenceDate || '2026-06-23');
      const minDate = new Date(conferenceDate);
      minDate.setDate(conferenceDate.getDate() - 3);
      const maxDate = new Date(conferenceDate);
      maxDate.setDate(conferenceDate.getDate() + 3);
      
      // Only allow dragging within enabled dates
      if (currentDate < minDate || currentDate > maxDate) {
        return; // Don't update if outside enabled range
      }
      
      console.log('📍 Dragging to:', dateStr);
      
      if (currentDate > dragStart) {
        // Dragging forward - set as check-out
        console.log('➡️ Forward drag - setting check-out to:', dateStr);
        setCheckInDate(dragStartDate);
        setCheckOutDate(dateStr);
      } else if (currentDate < dragStart) {
        // Dragging backward - swap dates
        console.log('⬅️ Backward drag - swapping dates');
        setCheckInDate(dateStr);
        setCheckOutDate(dragStartDate);
      } else {
        // Same date - only check-in
        setCheckInDate(dateStr);
        setCheckOutDate(dateStr);
      }
    }
  },  [isDragging, dragStartDate, registrationSettings]);

  const handleCalendarMouseUp = useCallback(() => {
    // Don't stop dragging on mouse up - only stop on second click
    console.log('🖱️ Mouse Up - but continuing drag mode');
  }, []);



  // Calculate total price using dynamic data
  const calculateTotalPrice = () => {
    let registrationPrice = 0;
    let accommodationPrice = 0;
    let accompanyingPersonsCost = 0;

    if (!dynamicData) return { 
      registrationPrice: 0, 
      totalRegistrationPrice: 0, 
      accommodationPrice: 0,
      accompanyingPersonsCost: 0,
      totalPrice: 0 
    };

    // Calculate registration price
    const selectedSponsorType = getSelection('sponsorshipType');
    const selectedRegistrationType = getSelection('registrationType');

    if (selectedSponsorType) {
      // Find sponsorship tier price (using name field from sponsorshipTiers)
      const sponsorTier = dynamicData.sponsorshipTiers?.find(tier =>
        tier.name?.toLowerCase() === selectedSponsorType.toLowerCase() ||
        tier.slug?.current === selectedSponsorType.toLowerCase()
      );

      if (sponsorTier) {
        // Use currency-aware pricing
        registrationPrice = getSponsorshipPrice(sponsorTier);
      } else {
        // Fallback to hardcoded sponsor pricing if not found in dynamic data
        const fallbackPricing: { [key: string]: number } = {
          'platinum': 7500,
          'gold': 6000,
          'silver': 5000,
          'exhibitor': 3000,
        };
        const usdPrice = fallbackPricing[selectedSponsorType.toLowerCase()] || 0;
        // Apply currency conversion for fallback pricing
        const conversionRates = { USD: 1, EUR: 0.85, GBP: 0.75, INR: 83 };
        registrationPrice = Math.round(usdPrice * (conversionRates[selectedCurrency] || 1));
      }
    } else if (selectedRegistrationType) {
      // Parse the registration type selection (format: typeId-periodId)
      const parts = selectedRegistrationType.split('-');
      if (parts.length >= 2) {
        // New format: typeId-periodId
        const typeId = parts[0];
        const periodId = parts[parts.length - 1]; // Last part is always periodId
        const regType = dynamicData.registrationTypes?.find(type => type._id === typeId);

        if (regType) {
          // Determine which pricing period to use
          let period: 'earlyBird' | 'nextRound' | 'onSpot' = 'earlyBird';

          if (dynamicData.activePeriod) {
            switch (dynamicData.activePeriod.periodId) {
              case 'nextRound':
                period = 'nextRound';
                break;
              case 'spotRegistration':
                period = 'onSpot';
                break;
              default:
                period = 'earlyBird';
                break;
            }
          }

          // Use currency-aware pricing
          registrationPrice = getRegistrationPrice(regType, period);
        }
      }
    }

    // Calculate accommodation price
    const selectedAccommodation = getSelection('accommodation');

    if (selectedAccommodation && dynamicData.accommodationOptions) {
      // Parse accommodation selection (format: hotelId-roomType)
      const [hotelId, roomType] = selectedAccommodation.split('-');

      const hotel = dynamicData.accommodationOptions?.find(h => h._id === hotelId);
      if (hotel) {
        const roomOption = hotel.roomOptions?.find(ro => ro.roomType === roomType);
        if (roomOption) {
          // Calculate total price using currency-aware pricing: pricePerNight * nights
          const pricePerNight = getAccommodationPrice(roomOption);
          accommodationPrice = pricePerNight * accommodationNights;
        }
      }
    }

    // Calculate accompanying persons cost (fixed 200 in all currencies)
    accompanyingPersonsCost = formData.numberOfAccompanyingPersons * getAccompanyingPersonPrice();

    const totalRegistrationPrice = registrationPrice * formData.numberOfParticipants;
    const totalPrice = totalRegistrationPrice + accommodationPrice + accompanyingPersonsCost;

    // Debug logging for pricing issues
    if (totalPrice === 0) {
      console.log('⚠️ Total price is 0, debugging pricing calculation:', {
        selectedSponsorType,
        selectedRegistrationType,
        registrationPrice,
        accommodationPrice,
        accompanyingPersonsCost,
        numberOfParticipants: formData.numberOfParticipants,
        activePeriod: dynamicData.activePeriod,
        registrationTypes: dynamicData.registrationTypes?.length,
        sponsorshipTiers: dynamicData.sponsorshipTiers?.length
      });
    }

    return {
      registrationPrice,
      totalRegistrationPrice,
      accommodationPrice,
      accompanyingPersonsCost,
      totalPrice
    };
  };

  const priceCalculation = useMemo(() => calculateTotalPrice(), [
    dynamicData,
    formData.numberOfParticipants,
    formData.numberOfAccompanyingPersons,
    selectedCurrency,
    accommodationNights,
    getSelection('sponsorshipType'),
    getSelection('registrationType'),
    getSelection('accommodation'),
    getSponsorshipPrice,
    getRegistrationPrice,
    getAccommodationPrice,
    getAccompanyingPersonPrice
  ]);

  // Handle payment success
  const handlePaymentSuccess = useCallback((paymentData: any) => {
    console.log('✅ Payment successful:', paymentData);
    setPaymentSuccess(true);

    // Redirect to success page with correct payment details
    const successUrl = `/registration/success?` +
      `registration_id=${paymentData.registrationId}&` +
      `transaction_id=${paymentData.transactionId}&` +
      `order_id=${paymentData.orderId}&` +
      `amount=${paymentData.amount}&` +
      `currency=${paymentData.currency}&` +
      `payment_method=${paymentData.paymentMethod || 'paypal'}&` +
      `status=completed&` +
      `captured_at=${encodeURIComponent(paymentData.paymentData?.capturedAt || new Date().toISOString())}`;

    router.push(successUrl);
  }, [router]);

  // Handle payment error
  const handlePaymentError = useCallback((error: any) => {
    console.error('❌ Payment failed:', {
      error: error instanceof Error ? error.message : 'Payment failed',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
      registrationId: currentRegistrationId,
      amount: calculateTotalPrice().totalPrice
    });

    // Provide detailed error message to user
    let userMessage = 'Payment processing failed. ';

    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('fetch')) {
        userMessage += 'Please check your internet connection and try again.';
      } else if (error.message.includes('declined') || error.message.includes('insufficient')) {
        userMessage += 'Your payment was declined. Please check your payment method or try a different card.';
      } else if (error.message.includes('timeout')) {
        userMessage += 'The payment request timed out. Please try again.';
      } else {
        userMessage += error.message;
      }
    } else {
      userMessage += 'An unexpected error occurred during payment processing.';
    }

    userMessage += '\n\nYour registration information has been saved. You can contact us at intelliglobalconferences@gmail.com to complete your payment manually.';

    alert(userMessage);
    setIsLoading(false);
  }, [currentRegistrationId, calculateTotalPrice]);

  // Handle payment cancellation
  const handlePaymentCancel = useCallback(() => {
    console.log('⚠️ Payment cancelled by user');
    alert('Payment was cancelled. Your registration information has been saved.\n\nYou can contact us at intelliglobalconferences@gmail.com to complete your payment manually.');
    setIsLoading(false);
  }, []);



  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate required fields with specific error messages
      const missingFields = [];

      if (!formData.firstName.trim()) missingFields.push('First Name');
      if (!formData.lastName.trim()) missingFields.push('Last Name');
      if (!formData.email.trim()) missingFields.push('Email');
      if (!formData.phoneNumber.trim()) missingFields.push('Phone Number');
      if (!formData.country.trim()) missingFields.push('Country');
      if (!formData.fullPostalAddress.trim()) missingFields.push('Full Postal Address');
      if (!formData.institution.trim()) missingFields.push('Institution');

      if (missingFields.length > 0) {
        alert(`Please fill in the following required fields:\n• ${missingFields.join('\n• ')}`);
        return;
      }

      // Check if either registration type or sponsorship is selected
      const selectedRegistrationType = getSelection('registrationType');
      const selectedSponsorType = getSelection('sponsorshipType');

      if (!selectedRegistrationType && !selectedSponsorType) {
        alert('Please select a registration type or sponsorship option');
        return;
      }

      // Get the registration type name for display
      let selectedRegistrationName = '';
      if (selectedRegistrationType && dynamicData) {
        const regTypeId = selectedRegistrationType.split('-')[0]; // Extract the registration type ID
        const selectedRegType = dynamicData.registrationTypes?.find(type => type._id === regTypeId);
        selectedRegistrationName = selectedRegType?.name || '';
      }

      // Prepare registration data for API
      const registrationData = {
        // Personal Details
        title: formData.title,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,

        // Further Information
        country: formData.country,
        fullPostalAddress: formData.fullPostalAddress,
        institution: formData.institution,

        // Registration Selection (using new format)
        selectedRegistration: selectedRegistrationType || '',
        selectedRegistrationName: selectedRegistrationName,
        sponsorType: selectedSponsorType || '',

        // Accommodation (using new selection format)
        accommodationType: getSelection('accommodation').split('-')[1] || '',
        accommodationNights: accommodationNights.toString(),
        checkInDate: checkInDate.toString().split('T')[0],
        checkOutDate: checkOutDate.toString().split('T')[0],

        // Participants
        numberOfParticipants: formData.numberOfParticipants,
        numberOfAccompanyingPersons: formData.numberOfAccompanyingPersons,

        // Pricing
        registrationFee: priceCalculation.registrationPrice,
        accommodationFee: priceCalculation.accommodationPrice,
        accompanyingPersonsCost: priceCalculation.accompanyingPersonsCost,
        totalPrice: priceCalculation.totalPrice,
        pricingPeriod: getActivePeriodId() || 'unknown',
        currency: selectedCurrency,
      };

      console.log('Submitting registration data:', registrationData);

      // Submit to API
      const response = await fetch('/api/registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      console.log('Registration successful:', result);

      // If total price is 0, just show success message
      if (priceCalculation.totalPrice === 0) {
        alert(`Registration submitted successfully! Registration ID: ${result.registrationId}`);
        // Reset form
        setFormData({
          title: '',
          firstName: '',
          lastName: '',
          email: '',
          phoneNumber: '',
          country: '',
          fullPostalAddress: '',
          institution: '',
          selectedRegistration: '',
          sponsorType: '',
          accommodationType: '',
          accommodationNights: '',
          numberOfParticipants: 1,
          numberOfAccompanyingPersons: 0,
          checkInDate: '',
          checkOutDate: '',
        });
        // Reset all selections
        resetAllSelections();
        return;
      }

      // Show PayPal payment section for payment processing
      console.log('💳 Proceeding to payment for registration:', result.registrationId);

      // Validate payment amount before showing PayPal section
      const currentPrice = calculateTotalPrice();
      if (currentPrice.totalPrice <= 0) {
        console.error('❌ Cannot proceed to payment: Invalid amount', currentPrice);
        alert('Payment amount calculation error. Please ensure you have selected a registration type or sponsorship option.');
        setIsLoading(false);
        return;
      }

      console.log('✅ Payment amount validated:', currentPrice.totalPrice);
      setCurrentRegistrationId(result.registrationId);
      setIsLoading(false);

    } catch (error) {
      console.error('❌ Registration submission error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
        formData: {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          totalPrice: calculateTotalPrice().totalPrice
        }
      });

      // Provide user-friendly error messages
      let userMessage = 'Registration submission failed. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          userMessage = 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
        } else if (error.message.includes('validation')) {
          userMessage = 'Please check your form data and ensure all required fields are filled correctly.';
        } else if (error.message.includes('timeout')) {
          userMessage = 'Request timeout: The server is taking too long to respond. Please try again.';
        } else if (error.message.includes('500')) {
          userMessage = 'Server error: There was an issue processing your registration. Please try again in a few minutes.';
        } else {
          userMessage = `Registration failed: ${error.message}`;
        }
      }

      alert(userMessage);

      // Additional debugging for development
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Debug info:', {
          currentRegistrationId,
          formDataKeys: Object.keys(formData),
          priceCalculation: calculateTotalPrice(),
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Early return for loading state
  if (dynamicLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (dynamicError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Unable to Load Registration Form</h2>
            <p className="text-red-700 mb-4">Please check your connection and try again.</p>
            <button
              onClick={refetchDynamicData}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Early return if no data - with debug info
  if (!dynamicData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No registration data available.</p>
          <div className="mt-4 text-xs text-gray-500 bg-gray-100 p-3 rounded">
            <p>Loading: {String(dynamicLoading)}</p>
            <p>Error: {dynamicError || 'None'}</p>
            <p>Data: {dynamicData ? 'Present' : 'Null'}</p>
          </div>
          <button
            onClick={refetchDynamicData}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gray-50">

      <section
        className="relative py-16 md:py-24"
        style={{
          backgroundImage: registrationSettings?.registrationImage?.asset?.url ? `url(${registrationSettings?.registrationImage?.asset?.url})` : undefined,
          backgroundColor: '#1e40af',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Fallback gradient if no image */}
        {!registrationSettings?.registrationImage?.asset?.url && (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900" />
        )}
        {/* 40% black overlay (force with inline style for reliability) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(8, 10, 12, 0.5)' }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
          <h1 className="uppercase text-3xl md:text-5xl font-extrabold text-white tracking-wide drop-shadow-md">
            {conferenceData?.hero?.conferenceSubject}
          </h1>
          <HeroBlinkText
          text={conferenceData?.hero?.registrationInfo}
          style={{
            background:"#0c1625",
            color:"#186FF0",
            border:"1px solid blue",
          }}
          />
          <h4 className="text-xl md:text-xl text-white drop-shadow-md">
            {conferenceData?.hero?.conferenceVenue} - {conferenceData?.hero?.conferenceDate}
          </h4>
            <h2 className="text-2xl md:text-5xl lg:text-6xl font-bold mt-50% mb-50% text-white">
              REGISTRATION
            </h2>
          </div>
        </div>
      </section>



      {/* Main Form Container */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          autoComplete="on"
          name="registrationForm"
          id="registrationForm"
        >

          {/* Personal Details Section */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
              <h2 className="text-lg font-bold text-white text-center">Personal Details</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <select
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    autoComplete="honorific-prefix"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Any</option>
                    <option value="Mr">Mr</option>
                    <option value="Ms">Ms</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Prof">Prof</option>
                    <option value="Dr">Dr</option>
                  </select>
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    placeholder="First Name *"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    autoComplete="given-name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    placeholder="Last Name *"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    autoComplete="family-name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Email *"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    autoComplete="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    placeholder="Phone Number *"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                    autoComplete="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Further Information Section - Compact */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
              <h2 className="text-lg font-bold text-white text-center">Further Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    autoComplete="country"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select country</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>

                {/* Full Postal Address - Now on same row */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Postal Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="fullPostalAddress"
                    name="fullPostalAddress"
                    value={formData.fullPostalAddress}
                    onChange={(e) => handleInputChange('fullPostalAddress', e.target.value)}
                    autoComplete="street-address"
                    rows={1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Institution or Organization <span className="text-red-500">*</span></label> 
                  <input
                    type="text"
                    id="institution"
                    name="institution"
                    placeholder="Institution *"
                    value={formData.institution}
                    onChange={(e) => handleInputChange('institution', e.target.value)}
                    autoComplete="organization"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Registration Type Section */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
              <h2 className="text-lg font-bold text-white text-center">Registration Type</h2>
            </div>
            <div className="p-6">
              
              {/* Compact Currency Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Select Currency</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-md mx-auto">
                  {[
                    { code: 'USD', symbol: '$' },
                    { code: 'EUR', symbol: '€' },
                    { code: 'GBP', symbol: '£' },
                    { code: 'INR', symbol: '₹' }
                  ].map((currency) => (
                    <button
                      key={currency.code}
                      type="button"
                      onClick={() => setSelectedCurrency(currency.code as any)}
                      className={`px-3 py-2 text-sm font-bold rounded-md transition-colors ${
                        selectedCurrency === currency.code
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-lg">{currency.symbol}</span>
                        <span className="text-xs">{currency.code}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Loading State */}
              {dynamicLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading registration options...</p>
                </div>
              )}

              {/* Error State */}
              {dynamicError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <div className="text-red-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error Loading Registration Data</h3>
                      <p className="text-sm text-red-700 mt-1">{dynamicError}</p>
                      <button
                        onClick={refetchDynamicData}
                        className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Content */}
              {dynamicData && (
                <>

                  {/* Dynamic Registration Types */}
                  <div className="space-y-6">
                    {/* Registration Types Table */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-6 text-center">Regular Registration</h3>

                      {/* Registration Table - Modern Card-Style Table with Borders */}
                      <div className="overflow-x-auto">
                        <div className="inline-block min-w-full border-2 border-gray-300 rounded-lg overflow-hidden">
                          {/* Table Header Row */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
                            {/* Category Header */}
                            <div className="bg-gray-300 text-gray-800 font-bold text-sm px-4 py-3 border-r-2 border-b-2 border-gray-300 flex items-center text-center">
                              TYPES OF PARTICIPATION
                            </div>
                            
                            {/* Period Headers */}
                            {dynamicData.pricingPeriods
                              ?.sort((a, b) => a.displayOrder - b.displayOrder)
                              ?.map((period, index, array) => {
                                const isActivePeriod = period._id === dynamicData.activePeriod?._id;
                                const isPastPeriod = new Date(period.endDate) < new Date();
                                const isFuturePeriod = new Date(period.startDate) > new Date();
                                const isLast = index === array.length - 1;

                                return (
                                  <div key={period._id} className={`${isLast ? '' : 'border-r-2'} border-b-2 border-gray-300`}>
                                    {/* Period Status Badge */}
                                    <div className={`px-3 py-1 text-center text-xs font-medium ${
                                      isActivePeriod
                                        ? 'bg-green-50 text-green-700'
                                        : isPastPeriod
                                        ? 'bg-gray-50 text-gray-500'
                                        : 'bg-blue-50 text-blue-700'
                                    }`}>
                                      {isActivePeriod ? '✓ Active' : isPastPeriod ? 'Ended' : 'Upcoming'}
                                    </div>

                                    {/* Period Header */}
                                    <div className={`px-3 py-2 text-white font-medium text-center text-sm ${
                                      isActivePeriod
                                        ? 'bg-green-600'
                                        : isFuturePeriod
                                        ? 'bg-blue-600'
                                        : 'bg-gray-500'
                                    }`}>
                                      <div className="text-sm font-semibold">{period.title}</div>
                                      <div className="text-xs opacity-90 mt-0.5">
                                        {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>

                          {/* Table Body - Registration Type Rows */}
                          {dynamicData.registrationTypes
                            ?.filter(type => type.isActive)
                            ?.sort((a, b) => {
                              const order = [
                                'speaker-inperson', 'speaker-virtual',
                                'listener-inperson', 'listener-virtual',
                                'student-inperson', 'student-virtual',
                                'eposter-virtual', 'exhibitor'
                              ];
                              return order.indexOf(a.category) - order.indexOf(b.category);
                            })
                            ?.map((regType, rowIndex, rowArray) => {
                              const isLastRow = rowIndex === rowArray.length - 1;
                              
                              return (
                                <div key={regType._id} className="grid grid-cols-1 md:grid-cols-4 gap-0">
                                  {/* Registration Type Name */}
                                  <div className={`bg-gray-100 px-4 py-3 border-r-2 ${isLastRow ? '' : 'border-b-2'} border-gray-300 flex items-center`}>
                                    <h4 className="font-medium text-base text-gray-700">{regType.name}</h4>
                                  </div>

                                  {/* Price Cells for Each Period */}
                                  {dynamicData.pricingPeriods
                                    ?.sort((a, b) => a.displayOrder - b.displayOrder)
                                    ?.map((period, colIndex, colArray) => {
                                      const isActivePeriod = period._id === dynamicData.activePeriod?._id;
                                      const periodPricing = regType.pricingByPeriod?.[period.periodId];
                                      const basePrice = periodPricing?.price || 0;
                                      const isLastCol = colIndex === colArray.length - 1;

                                      let pricingPeriod: 'earlyBird' | 'nextRound' | 'onSpot' = 'earlyBird';
                                      switch (period.periodId) {
                                        case 'nextRound':
                                          pricingPeriod = 'nextRound';
                                          break;
                                        case 'spotRegistration':
                                          pricingPeriod = 'onSpot';
                                          break;
                                        default:
                                          pricingPeriod = 'earlyBird';
                                          break;
                                      }

                                      const currencyPrice = getRegistrationPrice(regType, pricingPeriod);
                                      const hasValidPricing = basePrice > 0;
                                      const canSelect = isActivePeriod && hasValidPricing;

                                      return (
                                        <div 
                                          key={period._id}
                                          className={`bg-white px-4 py-3 ${isLastCol ? '' : 'border-r-2'} ${isLastRow ? '' : 'border-b-2'} border-gray-300 ${
                                            canSelect ? 'cursor-pointer hover:bg-gray-50' : ''
                                          }`}
                                          onClick={() => canSelect && handleRadioChange('registrationType', `${regType._id}-${period.periodId}`)}
                                        >
                                          {hasValidPricing ? (
                                            <div className="flex items-center justify-between">
                                              {canSelect && (
                                                <input
                                                  type="checkbox"
                                                  name="registrationType"
                                                  value={`${regType._id}-${period.periodId}`}
                                                  checked={isSelected('registrationType', `${regType._id}-${period.periodId}`)}
                                                  onChange={() => handleRadioChange('registrationType', `${regType._id}-${period.periodId}`)}
                                                  className="focus:ring-blue-500 accent-blue-600 w-3 h-3"
                                                  onClick={(e) => e.stopPropagation()}
                                                />
                                              )}
                                              <span className={`text-xs font-semibold ${!canSelect ? 'text-gray-400 ml-auto' : 'text-blue-600'}`}>
                                                {formatPrice(currencyPrice)}
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="text-center">
                                              <span className="text-xs text-gray-400">Not Available</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Sponsorship Types */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-6 text-center">Sponsorship Opportunities</h3>
                      <div className="flex flex-wrap justify-center gap-4">
                        {dynamicData.sponsorshipTiers
                          ?.filter(tier => tier.active)
                          ?.sort((a, b) => {
                            // Sort by order ascending (lowest first) or by price descending
                            if (a.order !== b.order) {
                              return a.order - b.order;
                            }
                            return b.price - a.price;
                          })
                          ?.map((tier) => {
                            const isTierSelected = isSelected('sponsorshipType', tier.name);

                            return (
                              <div
                                key={tier._id}
                                className={`relative border-2 rounded-lg p-3 bg-white border-gray-300 h-64 w-full sm:w-56
                                  transition-all duration-300 hover:shadow-md cursor-pointer
                                  ${isTierSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                                onClick={() => handleRadioChange('sponsorshipType', tier.name)}
                              >
                                {/* Tier Badge */}
                                <div className="absolute -top-2 left-3">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white bg-gray-600">
                                    {tier.name.toUpperCase()}
                                  </span>
                                </div>

                                {/* Selection Checkbox */}
                                <div className="absolute top-2 right-2">
                                  <input
                                    type="checkbox"
                                    name={`sponsorshipType-${tier.name}`}
                                    value={tier.name}
                                    checked={isTierSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleRadioChange('sponsorshipType', tier.name);
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    className="w-4 h-4 focus:ring-blue-500 accent-blue-600"
                                  />
                                </div>

                                <div className="mt-3 flex flex-col h-full">
                                  <h4 className="font-bold text-lg text-black mb-1">
                                    {tier.name}
                                  </h4>
                                  <div className="text-2xl font-bold text-black mb-2">
                                    {formatPrice(getSponsorshipPrice(tier))}
                                  </div>
                                  <p className="text-xs text-black mb-3 line-clamp-2">
                                    {tier.description}
                                  </p>

                                  {/* Benefits - Show first 2 + count */}
                                  {tier.benefits && tier.benefits.length > 0 && (
                                    <div className="flex-1">
                                      <h5 className="text-xs font-semibold text-black mb-1">
                                        Key Benefits:
                                      </h5>
                                      <ul className="space-y-0.5">
                                        {tier.benefits.slice(0, 2).map((benefit: any, idx: number) => (
                                          <li key={idx} className="flex items-start text-xs text-black">
                                            <span className="text-black mr-1 font-bold text-xs">✓</span>
                                            <span className="flex-1 line-clamp-2">
                                              {typeof benefit === 'string' ? benefit : benefit.benefit}
                                            </span>
                                          </li>
                                        ))}
                                        {tier.benefits.length > 2 && (
                                          <li className="text-xs text-black font-medium ml-3 mt-0.5">
                                            + {tier.benefits.length - 2} more benefits
                                          </li>
                                        )}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Availability Info */}
                                  {tier.featured && (
                                    <div className="mt-auto pt-2 border-t border-gray-300">
                                      <div className="text-xs text-black opacity-70">
                                        ⭐ Featured
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Accommodation Registration - Modern Design */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
              <h2 className="text-lg font-bold text-white text-center">Accommodation Registration</h2>
            </div>
            <div className="p-6">
              {/* Loading State */}
              {dynamicLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading accommodation options...</p>
                </div>
              )}

              {/* Error State */}
              {dynamicError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <div className="text-red-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error Loading Accommodation Data</h3>
                      <p className="text-sm text-red-700 mt-1">{dynamicError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Accommodation Options */}
              {dynamicData && dynamicData.accommodationOptions && (
                <div className="space-y-6">
                  {dynamicData.accommodationOptions
                    .filter(hotel => hotel.isActive)
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((hotel) => (
                      <div key={hotel._id} className="space-y-4">
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-gray-800">{hotel.hotelName}</h3>
                          <p className="text-sm text-gray-600 mt-1">{hotel.description}</p>
                        </div>

                        {/* Room Options as Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {hotel.roomOptions?.map((roomOption) => {
                            const accommodationKey = `${hotel._id}-${roomOption.roomType}`;
                            const pricePerNight = getAccommodationPrice(roomOption);
                            const isRoomSelected = isSelected('accommodation', accommodationKey);
                            const totalPrice = pricePerNight * accommodationNights;

                            return (
                              <div
                                key={roomOption.roomType}
                                className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                  isRoomSelected
                                    ? 'border-blue-500 bg-blue-50 shadow-md'
                                    : 'border-gray-300 bg-white hover:border-gray-400 hover:shadow-sm'
                                }`}
                                onClick={() => handleRadioChange('accommodation', accommodationKey)}
                              >
                                {/* Checkbox */}
                                <div className="absolute top-3 right-3">
                                  <input
                                    type="checkbox"
                                    checked={isRoomSelected}
                                    onChange={() => handleRadioChange('accommodation', accommodationKey)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-5 h-5 focus:ring-blue-500 accent-blue-600"
                                  />
                                </div>

                                {/* Room Type */}
                                <h4 className="font-bold text-base text-gray-900 mb-2 pr-8">
                                  {roomOption.roomType}
                                </h4>

                                {/* Room Description */}
                                <p className="text-sm text-gray-600 mb-3">
                                  {roomOption.roomDescription}
                                </p>

                                {/* Price Per Night */}
                                <div className="mb-3">
                                  <div className="text-xs text-gray-500 mb-1">Price per night</div>
                                  <div className="text-xl font-bold text-blue-600">
                                    {formatPrice(pricePerNight)}
                                  </div>
                                </div>

                                {/* Selected State - Show Total */}
                                {isRoomSelected && (
                                  <div className="mt-3 pt-3 border-t border-blue-200">
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-gray-700">
                                        {accommodationNights} night{accommodationNights !== 1 ? 's' : ''}
                                      </span>
                                      <span className="font-bold text-blue-700">
                                        Total: {formatPrice(totalPrice)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Check-in and Check-out Date Selector - Calendar View */}
                        {hotel.roomOptions?.some(ro => isSelected('accommodation', `${hotel._id}-${ro.roomType}`)) && (
                          <div className="bg-white border border-gray-300 rounded-lg p-3 max-w-xs mx-auto">
                            {/* Date Range Display */}
                            <div className="mb-2 pb-2 border-b border-gray-200">
                              <div className="flex items-center gap-1 text-[10px] text-gray-600 mb-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="font-semibold">DATES{checkInDate && checkOutDate ? ` (${accommodationNights} NIGHT${accommodationNights !== 1 ? 'S' : ''})` : ''}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <div>
                                  <div className="text-[9px] text-gray-500 mb-0.5">Check-in</div>
                                  <div className="font-semibold text-gray-900">
                                    {checkInDate ? new Date(checkInDate).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric'
                                    }) : '—'}
                                  </div>
                                </div>
                                <div className="text-gray-400 text-sm mx-1">→</div>
                                <div>
                                  <div className="text-[9px] text-gray-500 mb-0.5">Check-out</div>
                                  <div className="font-semibold text-gray-900">
                                    {checkOutDate ? new Date(checkOutDate).toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric'
                                    }) : '—'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Calendar Section */}
                            <div className="space-y-2">

                               {/* Helper Text */}
                              <div className="text-center text-[9px] text-black-500">
                                <b>Note: Click and drag to select</b>
                              </div>

                              {/* Month Header */}
                              <div className="text-center">
                                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                  {new Date(registrationSettings?.conferenceDetails?.conferenceDate || '2026-06-23').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </h3>
                              </div>

                              {/* Calendar Grid */}
                              <div className="bg-white">
                              
                                {/* Day Headers */}
                                <div className="grid grid-cols-7 mb-1">
                                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                                    <div key={`${day}-${idx}`} className="text-center text-[9px] font-semibold text-gray-500 py-0.5">
                                      {day}
                                    </div>
                                  ))}
                                </div>

                                {/* Calendar Days */}
                                <div className="grid grid-cols-7">
                                  {(() => {
                                    // Conference date: June 23, 2025 - 3 days before and after
                                    const conferenceDate = new Date(registrationSettings?.conferenceDetails?.conferenceDate || '2026-06-23');
                                    const year = conferenceDate.getFullYear();
                                    const month = conferenceDate.getMonth(); // 5 for June (0-indexed)
                                    
                                    const firstDay = new Date(year, month, 1).getDay();
                                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                                    
                                    // Calculate enabled range: 3 days before to 3 days after conference
                                    const minDate = new Date(conferenceDate);
                                    minDate.setDate(conferenceDate.getDate() - 3); // June 20
                                    
                                    const maxDate = new Date(conferenceDate);
                                    maxDate.setDate(conferenceDate.getDate() + 3); // June 26
                                    
                                    const checkInDateObj = new Date(checkInDate);
                                    const checkOutDateObj = new Date(checkOutDate);
                                    
                                    const days = [];
                                    
                                    // Add empty cells for days before month starts
                                    for (let i = 0; i < firstDay; i++) {
                                      days.push(
                                        <div key={`empty-${i}`} className="w-8 h-8"></div>
                                      );
                                    }
                                    
                                    // Add all days of the month
                                    for (let day = 1; day <= daysInMonth; day++) {
                                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                      const date = new Date(dateStr);
                                      const isEnabled = date >= minDate && date <= maxDate;
                                      const isCheckIn = dateStr === checkInDate;
                                      const isCheckOut = dateStr === checkOutDate;
                                      const isInRange = date > checkInDateObj && date < checkOutDateObj;
                                      const isSingleDay = isCheckIn && isCheckOut;
                                      const isStartOfRange = isCheckIn && !isSingleDay;
                                      const isEndOfRange = isCheckOut && !isSingleDay;
                                      
                                      days.push(
                                        <button
                                          key={day}
                                          type="button"
                                          disabled={!isEnabled}
                                          onMouseDown={(e) => {
                                            if (isEnabled) {
                                              e.preventDefault();
                                              handleCalendarMouseDown(dateStr);
                                            }
                                          }}
                                          onMouseEnter={(e) => {
                                            if (isEnabled) {
                                              handleCalendarMouseEnter(dateStr);
                                            }
                                          }}
                                          onMouseUp={(e) => {
                                            e.preventDefault();
                                            handleCalendarMouseUp();
                                          }}
                                          onTouchStart={(e) => {
                                            if (isEnabled) {
                                              e.preventDefault();
                                              handleCalendarMouseDown(dateStr);
                                            }
                                          }}
                                          onTouchMove={(e) => {
                                            if (isEnabled && isDragging) {
                                              const touch = e.touches[0];
                                              const element = document.elementFromPoint(touch.clientX, touch.clientY);
                                              const dateAttr = element?.getAttribute('data-date');
                                              if (dateAttr) {
                                                const touchDate = new Date(dateAttr);
                                                if (touchDate >= minDate && touchDate <= maxDate) {
                                                  handleCalendarMouseEnter(dateAttr);
                                                }
                                              }
                                            }
                                          }}
                                          onTouchEnd={(e) => {
                                            e.preventDefault();
                                            handleCalendarMouseUp();
                                          }}
                                          data-date={dateStr}
                                          className={`w-8 h-8 flex items-center justify-center text-[11px] font-medium transition-all select-none relative
                                            ${!isEnabled ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
                                            ${isEnabled && !isCheckIn && !isCheckOut && !isInRange ? 'text-gray-700 hover:bg-gray-100' : ''}
                                            ${(isStartOfRange || isSingleDay) ? 'bg-blue-600 text-white font-bold rounded-l-full' : ''}
                                            ${(isEndOfRange) ? 'bg-blue-600 text-white font-bold rounded-r-full' : ''}
                                            ${isInRange ? 'bg-blue-600 text-white font-bold' : ''}
                                          `}
                                        >
                                          <span className="relative z-10">{day}</span>
                                        </button>
                                      );
                                    }
                                    
                                    return days;
                                  })()}
                                </div>
                              </div>

                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>



          {/* Number of Participants - With Accompanying Persons */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
              <h2 className="text-lg font-bold text-white text-center">Participants</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Number of Participants */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    No. Of Participants ({formData.numberOfParticipants})
                  </label>
                  <select
                    id="numberOfParticipants"
                    name="numberOfParticipants"
                    value={formData.numberOfParticipants}
                    onChange={(e) => handleInputChange('numberOfParticipants', parseInt(e.target.value))}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>

                {/* Number of Accompanying Persons */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    No. Of Accompanying Persons: {formData.numberOfAccompanyingPersons} ({formatPrice(getAccompanyingPersonPrice())} per person)
                  </label>
                  <select
                    id="numberOfAccompanyingPersons"
                    name="numberOfAccompanyingPersons"
                    value={formData.numberOfAccompanyingPersons}
                    onChange={(e) => handleInputChange('numberOfAccompanyingPersons', parseInt(e.target.value))}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                  {formData.numberOfAccompanyingPersons > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      Cost: {formatPrice(formData.numberOfAccompanyingPersons * getAccompanyingPersonPrice())} 
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details and Payment Method - Vertical Stack Layout */}
          <div className="space-y-6">
            {/* Payment Details */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
                <h2 className="text-lg font-bold text-white text-center">Payment Details</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Registration Price :</span>
                    <span>{formatPrice(priceCalculation.registrationPrice)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">No. Of Participants :</span>
                    <span>{formData.numberOfParticipants}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Total Registration Price :</span>
                    <span>{formatPrice(priceCalculation.totalRegistrationPrice)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Accommodation Registration Price :</span>
                    <span>{formatPrice(priceCalculation.accommodationPrice)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Accompanying Persons ({formData.numberOfAccompanyingPersons}) :</span>
                    <span>{formatPrice(priceCalculation.accompanyingPersonsCost)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b font-bold text-lg">
                    <span>Total Price :</span>
                    <span>{formatPrice(priceCalculation.totalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Complete Payment Section - Always Visible */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
                <h2 className="text-lg font-bold text-white text-center">Complete Payment</h2>
              </div>
              <div className="p-6">
                {(() => {
                  // Check form validation (allow single character names and addresses)
                  const isFormValid = formData.firstName.trim() && formData.lastName.trim() && formData.email.trim() &&
                                     formData.phoneNumber.trim() && formData.country.trim() && formData.fullPostalAddress.trim() && formData.institution.trim();

                  // Check if registration type or sponsorship is selected
                  const selectedRegistrationType = getSelection('registrationType');
                  const selectedSponsorType = getSelection('sponsorshipType');
                  const hasSelection = selectedRegistrationType || selectedSponsorType;

                  // Check if total price is valid
                  const hasValidPrice = priceCalculation.totalPrice > 0;

                  // Check if registration is saved
                  const isRegistrationSaved = !!currentRegistrationId;

                  if (!isFormValid) {
                    return (
                      <div className="text-center">
                        <div className="mb-4">
                          <div className="text-gray-400 text-4xl mb-2">📝</div>
                          <p className="text-gray-600 mb-2">Complete the form to proceed</p>
                          <p className="text-sm text-gray-500">Fill in all required fields above</p>
                        </div>
                      </div>
                    );
                  }

                  if (!hasSelection) {
                    return (
                      <div className="text-center">
                        <div className="mb-4">
                          <div className="text-gray-400 text-4xl mb-2">🎯</div>
                          <p className="text-gray-600 mb-2">Select registration type</p>
                          <p className="text-sm text-gray-500">Choose a registration type or sponsorship plan</p>
                        </div>
                      </div>
                    );
                  }

                  if (!hasValidPrice) {
                    return (
                      <div className="text-center">
                        <div className="mb-4">
                          <div className="text-gray-400 text-4xl mb-2">💰</div>
                          <p className="text-gray-600 mb-2">Invalid price calculation</p>
                          <p className="text-sm text-gray-500">Please check your selection</p>
                        </div>
                      </div>
                    );
                  }

                  if (!isRegistrationSaved) {
                    return (
                      <div className="text-center">
                        <div className="mb-4 text-center">
                          <p className="text-gray-600 mb-2">
                            Please complete your payment to confirm your registration
                          </p>
                          <div className="text-2xl font-bold text-blue-600">
                            {formatPrice(priceCalculation.totalPrice)}
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full bg-green-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isLoading ? 'Saving Registration...' : 'Save Registration & Continue to Payment'}
                        </button>
                      </div>
                    );
                  }

                  // All conditions met - show payment options
                  return (
                      <div>
                        <div className="mb-6 text-center">
                          <p className="text-gray-600 mb-2">
                            Please complete your payment to confirm your registration
                          </p>
                          <div className="text-2xl font-bold text-blue-600">
                            {formatPrice(priceCalculation.totalPrice)}
                          </div>
                        </div>

                        {/* Payment Options Header */}
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-gray-800 text-center mb-3">
                            Choose Your Payment Method
                          </h3>
                          <p className="text-sm text-gray-600 text-center">
                            Select your preferred payment option below
                          </p>
                        </div>

                        {/* Payment Buttons Grid - Rows on mobile, side by side on larger screens */}
                        <div className={`grid ${selectedCurrency === 'INR' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-3 sm:gap-4 items-stretch`}>
                          {/* PayPal Payment Option — hidden for INR (Razorpay only) */}
                          {selectedCurrency !== 'INR' && (
                          <div className="space-y-2 flex flex-col h-full">
                            <div className="text-center">
                              <h4 className="font-medium text-gray-700 mb-1 text-sm sm:text-base">PayPal</h4>
                              <p className="text-xs text-gray-500 mb-2 sm:mb-3 px-1">
                                Pay securely with PayPal, credit cards, or debit cards
                              </p>
                            </div>
                            <div className="flex-1">
                              <PayPalErrorBoundary>
                                <PayPalButtonReliable
                                  amount={priceCalculation.totalPrice}
                                  currency={selectedCurrency}
                                  registrationId={currentRegistrationId}
                                  registrationData={formData}
                                  onSuccess={handlePaymentSuccess}
                                  onError={handlePaymentError}
                                  onCancel={handlePaymentCancel}
                                  onRegistrationIdUpdate={(newId) => {
                                    console.log('🔄 Registration ID updated from PayPal:', newId);
                                    setCurrentRegistrationId(newId);
                                  }}
                                  disabled={isLoading}
                                />
                              </PayPalErrorBoundary>
                            </div>
                          </div>
                          )}

                          {/* Razorpay Payment Option */}
                          <div className="space-y-2 flex flex-col h-full">
                            <div className="text-center">
                              <h4 className="font-medium text-gray-700 mb-1 text-sm sm:text-base">Razorpay</h4>
                              <p className="text-xs text-gray-500 mb-2 sm:mb-3 px-1">
                                Pay with UPI, credit cards, or debit cards, net banking, and wallets
                              </p>
                            </div>
                            <div className="flex-1">
                              <RazorpayButton
                                  amount={priceCalculation.totalPrice}
                                  currency={selectedCurrency}
                                  registrationId={currentRegistrationId}
                                  registrationData={formData}
                                  onSuccess={handlePaymentSuccess}
                                  onError={handlePaymentError}
                                  onCancel={handlePaymentCancel}
                                  onRegistrationIdUpdate={(newId) => {
                                    console.log('🔷 Registration ID updated from Razorpay:', newId);
                                    setCurrentRegistrationId(newId);
                                  }}
                                  disabled={isLoading}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Security Notice */}
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                          <div className="flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xs text-green-700 text-center">
                              Your payment is secured with 256-bit SSL encryption
                            </p>
                          </div>
                        </div>
                      </div>
                  );
                })()}
              </div>
            </div>

          </div>

          {/* Registration Include Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Registration Include */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
                <h2 className="text-lg font-bold text-white text-center">REGISTRATION INCLUDE</h2>
              </div>
              <div className="p-6">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">Access to all Scientific Sessions, Poster sessions, Exhibitions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">Handbook & Conference Materials</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">Lunch, tea / coffee breaks during the conference days</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">Certificate Accreditation from the Organizing Committee</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">Access to the attendees email list (post conference)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">WiFi in meeting rooms</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Delegate Registration Include */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
                <h2 className="text-lg font-bold text-white text-center">DELEGATE REGISTRATION INCLUDE</h2>
              </div>
              <div className="p-6">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">Access to all Scientific Sessions, Poster sessions, Exhibitions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">Lunch, tea / coffee breaks during the conference days</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">Certificate Accreditation from the Organizing Committee</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <span className="text-gray-700">Delegates are not allowed to present their papers in Oral or Poster sessions.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Cancellation Policy */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="bg-blue-800 text-white px-6 py-3 rounded-t-lg">
              <h2 className="text-lg font-bold text-white text-center">CANCELLATION POLICY</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4 text-gray-700">
                <p>
                  We understand that sometimes plans change. Please review our cancellation policy below:
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <div>
                      <span className="font-semibold">Cancellations made 90 days before the conference:</span>
                      <span className="ml-2">will receive a <b>refund of 75%</b> of the registration fee.</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <div>
                      <span className="font-semibold">Cancellations made 45+ days before conference:</span>
                      <span className="ml-2">will receive a <b>refund of 50%</b> of the registration fee.</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <div>
                      <span className="font-semibold">Cancellations made 45 days before conference:</span>
                      <span className="ml-2"><b>No refund available</b></span>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <div>
                      <span className="font-semibold">Refund policy time frame:</span>
                      <span className="ml-2">All refund processing will be completed after the conference date. Please allow <b>4-6 weeks</b> for refund processing.All bank service charges and transaction fees for refunds must be covered by the participant.
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <div>
                      <span className="font-semibold">Transfer Requests to another person:</span>
                      <span className="ml-2">All fully paid registrations are transferable to other persons from the same organization, if the registered person is unable to attend the event. Transfers must be made by the registered person in writing to <b>contactus@intelliglobalconferences.com</b> Details must include the full name of replacement person, their title, contact phone number and email address.Alternatively, you may transfer your registration to the next edition of the conference or to another event organized by Intelli global Meetings. Registrations are transferable up to 14 days prior to {new Date(registrationSettings?.conferenceDetails?.conferenceDate || '2026-08-24').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
                      </span>
                    </div>
                  </div>
                </div>

                  <div className="flex items-start">
                    <span className="text-blue-600 mr-3 mt-1 font-bold">•</span>
                    <div>
                      <span className="font-semibold">Postponment/Cancellation of event:</span>
                      <span className="ml-2">If the conference postpones an event for any reason and you are unable or unwilling to attend on rescheduled dates, you will receive a credit for 100% of the registration fee paid. You may use this credit for another event which must occur within one year from the date of postponement.
                      </span>
                    </div>
                  </div>

                <p className="mt-4 text-sm text-gray-600 italic">
                  All cancellation and transfer requests must be submitted to contactus@intelliglobalconferences.com in writing via email for proper documentation.
                </p>
              </div>
            </div>
          </div>

        </form>

        {/* Success Message */}
        {paymentSuccess && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg">
                <h2 className="text-xl font-bold">Registration Successful! 🎉</h2>
              </div>
              <div className="p-6 text-center">
                <div className="text-6xl mb-4">✅</div>
                <p className="text-gray-700 mb-4">
                  Your registration and payment have been processed successfully!
                </p>
                <button
                  onClick={() => {
                    setPaymentSuccess(false);
                    // Optionally redirect to home or success page
                    window.location.href = '/';
                  }}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PayPal integration now uses simple, clean implementation */}
    </div>
  );
}

export default function RegistrationPage() {
  return (
    <CurrencyProvider>
      <RegistrationPageContent />
    </CurrencyProvider>
  );
}