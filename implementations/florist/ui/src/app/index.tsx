import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';


type ResultMetadata = {
  title: string;
  qualifiers: string[];
  resultCount: number;
};


type ResultRow = Record<string, unknown>;


type IntentResult = {
  metadata: ResultMetadata;
  dataset: ResultRow[];
};


/**
 * Backend endpoint used by the first AEA vertical slice.
 *
 * For web development the Expo application and backend run
 * independently, so the browser calls the local backend directly.
 *
 * We can move this into environment configuration once the
 * vertical slice is established.
 */
const API_URL =
  Platform.OS === 'web'
    ? 'http://localhost:3001/api/intent'
    : 'http://localhost:3001/api/intent';


/**
 * Converts dataset field names into readable column headings.
 *
 * Examples:
 *
 *   productName        -> Product Name
 *   productDescription -> Product Description
 *   priceUsd           -> Price Usd
 */
function formatColumnHeading(field: string): string {
  return field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (character) => character.toUpperCase());
}


/**
 * Converts arbitrary dataset values into something suitable
 * for the generic first-iteration grid.
 */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}


export default function HomeScreen() {

  const [prompt, setPrompt] =
    useState('Show me everything Lily has to offer.');

  const [result, setResult] =
    useState<IntentResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);


  /**
   * Sends the user's natural-language intent to the AEA backend.
   *
   * The UI does not know which agentic capability will execute.
   * It only understands the common Resulting Data Store contract.
   */
  async function submitIntent() {

    const trimmedPrompt =
      prompt.trim();

    if (!trimmedPrompt || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {

      const response =
        await fetch(API_URL, {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            prompt: trimmedPrompt,
          }),
        });


      if (!response.ok) {
        throw new Error(
          `Request failed with status ${response.status}`
        );
      }


      const data =
        await response.json() as IntentResult;

      setResult(data);

    } catch (requestError) {

      console.error(
        'Intent request failed:',
        requestError
      );

      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to process intent.'
      );

    } finally {
      setLoading(false);
    }
  }


  const columns =
    result?.dataset.length
      ? Object.keys(result.dataset[0])
      : [];


  return (
    <ThemedView style={styles.container}>

      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <ThemedText
            type="title"
            style={styles.brand}
          >
            Lily
          </ThemedText>

          <ThemedText style={styles.subtitle}>
            What are you looking for?
          </ThemedText>
        </View>


        <View style={styles.intentRow}>

          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Tell Lily what you're looking for..."
            style={styles.intentInput}
            editable={!loading}
            onSubmitEditing={submitIntent}
          />

          <Pressable
            onPress={submitIntent}
            disabled={loading}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              loading && styles.submitButtonDisabled,
            ]}
          >
            <ThemedText style={styles.submitButtonText}>
              Search
            </ThemedText>
          </Pressable>

        </View>


        {loading && (
          <View style={styles.statusRow}>
            <ActivityIndicator />

            <ThemedText>
              Understanding your request...
            </ThemedText>
          </View>
        )}


        {error && (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>
              {error}
            </ThemedText>
          </View>
        )}


        {result && !loading && (

          <View style={styles.resultContainer}>

            <View style={styles.resultHeader}>

              <ThemedText
                type="subtitle"
                style={styles.resultTitle}
              >
                {result.metadata.title}
              </ThemedText>

              <ThemedText style={styles.resultCount}>
                {result.metadata.resultCount} results
              </ThemedText>

            </View>


            <ScrollView
              horizontal
              style={styles.gridScroll}
            >

              <View>

                <View style={styles.gridHeaderRow}>

                  {columns.map((column) => (
                    <View
                      key={column}
                      style={styles.gridCell}
                    >
                      <ThemedText style={styles.gridHeaderText}>
                        {formatColumnHeading(column)}
                      </ThemedText>
                    </View>
                  ))}

                </View>


                <ScrollView style={styles.gridBody}>

                  {result.dataset.map((row, rowIndex) => (

                    <View
                      key={rowIndex}
                      style={styles.gridRow}
                    >

                      {columns.map((column) => (

                        <View
                          key={column}
                          style={styles.gridCell}
                        >
                          <ThemedText style={styles.gridText}>
                            {formatCellValue(row[column])}
                          </ThemedText>
                        </View>

                      ))}

                    </View>

                  ))}

                </ScrollView>

              </View>

            </ScrollView>


            <View style={styles.qualifierSection}>

              <ThemedText style={styles.qualifierLabel}>
                Filters
              </ThemedText>

              <ThemedText style={styles.qualifierText}>
                {result.metadata.qualifiers.length
                  ? result.metadata.qualifiers.join(' · ')
                  : 'None'}
              </ThemedText>

            </View>

          </View>

        )}

      </SafeAreaView>

    </ThemedView>
  );
}


const styles = StyleSheet.create({

  container: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    padding: 24,
    gap: 20,
  },

  header: {
    gap: 4,
  },

  brand: {
    fontSize: 32,
  },

  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },

  intentRow: {
    flexDirection: 'row',
    gap: 12,
  },

  intentInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#c8c8c8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    color: '#111111',
    fontSize: 16,
  },

  submitButton: {
    minWidth: 100,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#222222',
    paddingHorizontal: 20,
  },

  submitButtonPressed: {
    opacity: 0.8,
  },

  submitButtonDisabled: {
    opacity: 0.5,
  },

  submitButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  errorContainer: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#cc6666',
    borderRadius: 8,
  },

  errorText: {
    color: '#aa2222',
  },

  resultContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    overflow: 'hidden',
  },

  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },

  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
  },

  resultCount: {
    opacity: 0.65,
  },

  gridScroll: {
    flex: 1,
  },

  gridBody: {
    flex: 1,
  },

  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#eeeeee',
  },

  gridRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e2e2',
  },

  gridCell: {
    width: 190,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#e2e2e2',
  },

  gridHeaderText: {
    fontWeight: '600',
  },

  gridText: {
    fontSize: 14,
  },

  qualifierSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
    gap: 3,
  },

  qualifierLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    textTransform: 'uppercase',
  },

  qualifierText: {
    fontSize: 14,
  },

});