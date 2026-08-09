import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  BotMessageSquare,
  Check,
  CheckCircle2,
  Clock3,
  Pencil,
  MessageCircleQuestion,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react-native";

import Card from "../../../components/Card";
import { useAuth } from "../../../contexts/AuthContext";
import {
  cancelChatAction,
  confirmChatAction,
  deleteChatConversation,
  getChatConversation,
  listChatConversations,
  retryChatMessage,
  sendChatMessage,
} from "../../../services/chatbotService";


const SUGGESTIONS = [
  {
    title: "Resumo financeiro",
    prompt: "Como estão minhas finanças neste mês?",
  },
  {
    title: "Próximos compromissos",
    prompt: "O que tenho para pagar e receber nos próximos 30 dias?",
  },
  {
    title: "Gastos por categoria",
    prompt: "Em quais categorias eu mais gastei neste mês?",
  },
];


function firstName(name) {
  return name?.trim()?.split(/\s+/)?.[0] || "por aí";
}


function markdownToPlainText(value) {
  return String(value ?? "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?|```/g, ""))
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`|\*|_)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


function ConversationCard({
  title,
  preview,
  onPress,
  onDelete,
  isDeleting,
}) {
  const plainPreview = markdownToPlainText(preview);

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      containerStyle={styles.conversationSwipeable}
      renderRightActions={(_progress, _translation, swipeableMethods) => (
        <Pressable
          style={styles.conversationDeleteAction}
          onPress={() => {
            swipeableMethods.close();
            onDelete();
          }}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel="Excluir conversa"
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Trash2 size={21} color="#ffffff" />
          )}
          <Text style={styles.conversationDeleteText}>Excluir</Text>
        </Pressable>
      )}
    >
      <Card className="min-h-[68px]" onPress={onPress}>
        <View style={styles.cardRow}>
          <View style={styles.chatCardIcon}>
            <BotMessageSquare size={24} color="#343A40" />
          </View>
          <View style={styles.chatCardCopy}>
            <Text style={styles.chatCardTitle} numberOfLines={1}>
              {title || "Conversa com a Araris"}
            </Text>
            <Text style={styles.chatCardPreview} numberOfLines={2}>
              “{plainPreview || "Conversa iniciada com a Araris"}”
            </Text>
          </View>
        </View>
      </Card>
    </ReanimatedSwipeable>
  );
}


function SuggestionCard({ title, prompt, onPress }) {
  return (
    <Card className="min-h-[68px]" onPress={onPress}>
      <View style={styles.cardRow}>
        <View style={styles.suggestionIcon}>
          <MessageCircleQuestion size={22} color="#0063f5" />
        </View>
        <View style={styles.chatCardCopy}>
          <Text style={styles.chatCardTitle}>{title}</Text>
          <Text style={styles.chatCardPreview}>{prompt}</Text>
        </View>
      </View>
    </Card>
  );
}


function Overview({
  name,
  conversations,
  isLoading,
  error,
  deletingConversationId,
  onBack,
  onConversationPress,
  onConversationDelete,
  onSuggestionPress,
}) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={styles.overviewContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        className="mb-4 self-start flex-row items-center py-1"
        onPress={onBack}
        hitSlop={8}
      >
        <ArrowLeft size={14} color="#343A40" />
        <Text className="ml-1 font-poppins-medium text-xs text-texto-primario">
          Voltar
        </Text>
      </Pressable>

      <View className="items-center">
        <Image
          source={require("../../../assets/images/araris_frente.png")}
          className="h-[76px] w-[76px]"
          resizeMode="contain"
        />
        <Text className="mt-2 text-center font-poppins-semibold text-[21px] leading-7 text-texto-primario">
          Olá, {name}
          {"\n"}Como posso te ajudar?
        </Text>
      </View>

      <View className="mt-8 gap-4">
        <View>
          <Text style={styles.sectionTitle}>Chats Recentes</Text>
          {isLoading ? (
            <ActivityIndicator className="py-8" color="#0063f5" />
          ) : conversations.length > 0 ? (
            <View style={styles.cardList}>
              {conversations.slice(0, 3).map((conversation) => (
                <ConversationCard
                  key={conversation.id}
                  title={conversation.title}
                  preview={conversation.preview}
                  onPress={() => onConversationPress(conversation.id)}
                  onDelete={() => onConversationDelete(conversation)}
                  isDeleting={deletingConversationId === conversation.id}
                />
              ))}
            </View>
          ) : (
            <Card className="min-h-[68px]">
              <View style={styles.cardRow}>
                <View style={styles.chatCardIcon}>
                  <BotMessageSquare size={24} color="#343A40" />
                </View>
                <View style={styles.chatCardCopy}>
                  <Text style={styles.chatCardTitle}>Nenhuma conversa ainda</Text>
                  <Text style={styles.chatCardPreview}>
                    Escolha uma sugestão ou escreva sua primeira pergunta.
                  </Text>
                </View>
              </View>
            </Card>
          )}
        </View>

        {error ? (
          <Text className="font-poppins-regular text-sm text-red-600">
            {error}
          </Text>
        ) : null}

        <View>
          <Text style={styles.sectionTitle}>Sugestões para começar</Text>
          <View style={styles.cardList}>
            {SUGGESTIONS.map((suggestion) => (
              <SuggestionCard
                key={suggestion.title}
                title={suggestion.title}
                prompt={suggestion.prompt}
                onPress={() => onSuggestionPress(suggestion.prompt)}
              />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}


function renderInlineMarkdown(value, keyPrefix, color = "#343A40") {
  const tokenPattern =
    /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\n]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;
  const parts = [];
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(value)) !== null) {
    if (match.index > cursor) {
      parts.push(value.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith("**") || token.startsWith("__")) {
      parts.push(
        <Text key={key} style={[styles.markdownStrong, { color }]}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (token.startsWith("~~")) {
      parts.push(
        <Text key={key} style={[styles.markdownStrike, { color }]}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (token.startsWith("`")) {
      parts.push(
        <Text key={key} style={styles.markdownInlineCode}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (token.startsWith("[")) {
      const separator = token.indexOf("](");
      const label = token.slice(1, separator);
      const url = token.slice(separator + 2, -1);
      parts.push(
        <Text
          key={key}
          style={styles.markdownLink}
          onPress={() => Linking.openURL(url)}
        >
          {label}
        </Text>,
      );
    } else {
      parts.push(
        <Text key={key} style={[styles.markdownEmphasis, { color }]}>
          {token.slice(1, -1)}
        </Text>,
      );
    }
    cursor = match.index + token.length;
  }

  if (cursor < value.length) {
    parts.push(value.slice(cursor));
  }
  return parts;
}


function parseMarkdownBlocks(content) {
  const lines = String(content ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", content: codeLines.join("\n") });
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        content: heading[2],
      });
      index += 1;
      continue;
    }

    const unorderedItem = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unorderedItem) {
      blocks.push({ type: "bullet", content: unorderedItem[1] });
      index += 1;
      continue;
    }

    const orderedItem = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (orderedItem) {
      blocks.push({
        type: "ordered",
        marker: `${orderedItem[1]}.`,
        content: orderedItem[2],
      });
      index += 1;
      continue;
    }

    if (/^\s*(---+|___+)\s*$/.test(line)) {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    if (line.trim().startsWith(">")) {
      blocks.push({ type: "quote", content: line.replace(/^\s*>\s?/, "") });
      index += 1;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+[.)]\s+/.test(lines[index]) &&
      !/^\s*>/.test(lines[index]) &&
      !lines[index].trim().startsWith("```") &&
      !/^\s*(---+|___+)\s*$/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraph.join(" ") });
  }

  return blocks;
}


function MarkdownMessage({ content, isError = false }) {
  const color = isError ? "#dc2626" : "#343A40";
  const blocks = parseMarkdownBlocks(content);

  return (
    <View style={styles.markdownBody}>
      {blocks.map((block, index) => {
        const key = `markdown-${index}`;
        if (block.type === "divider") {
          return <View key={key} style={styles.markdownDivider} />;
        }
        if (block.type === "code") {
          return (
            <View key={key} style={styles.markdownCodeBlock}>
              <Text style={styles.markdownCodeText}>{block.content}</Text>
            </View>
          );
        }
        if (block.type === "bullet" || block.type === "ordered") {
          return (
            <View key={key} style={styles.markdownListRow}>
              <Text style={[styles.markdownListMarker, { color }]}>
                {block.type === "bullet" ? "•" : block.marker}
              </Text>
              <Text style={[styles.markdownText, styles.markdownListText, { color }]}>
                {renderInlineMarkdown(block.content, key, color)}
              </Text>
            </View>
          );
        }
        if (block.type === "heading") {
          return (
            <Text
              key={key}
              style={[
                styles.markdownHeading,
                block.level === 1 && styles.markdownHeading1,
                block.level === 2 && styles.markdownHeading2,
                { color },
              ]}
            >
              {renderInlineMarkdown(block.content, key, color)}
            </Text>
          );
        }
        if (block.type === "quote") {
          return (
            <View key={key} style={styles.markdownQuote}>
              <Text style={[styles.markdownText, { color }]}>
                {renderInlineMarkdown(block.content, key, color)}
              </Text>
            </View>
          );
        }
        return (
          <Text key={key} style={[styles.markdownText, { color }]}>
            {renderInlineMarkdown(block.content, key, color)}
          </Text>
        );
      })}
    </View>
  );
}


const ACTION_STATUS = {
  pending: {
    backgroundColor: "#eef5ff",
    color: "#0063f5",
    icon: Clock3,
  },
  confirmed: {
    backgroundColor: "#e8f8ef",
    color: "#14804a",
    icon: CheckCircle2,
  },
  canceled: {
    backgroundColor: "#f1f3f5",
    color: "#6C757D",
    icon: XCircle,
  },
  expired: {
    backgroundColor: "#fff4df",
    color: "#b86b00",
    icon: Clock3,
  },
  failed: {
    backgroundColor: "#fdebec",
    color: "#c92a2a",
    icon: XCircle,
  },
};


function PendingActionCard({
  action,
  busy,
  onConfirm,
  onCancel,
  onEdit,
}) {
  const status = ACTION_STATUS[action.status] || ACTION_STATUS.pending;
  const StatusIcon = status.icon;
  const isPending = action.status === "pending";
  const isDelete = action.action_type === "delete";
  const rows = action.summary?.rows || [];
  const completionMessage = action.result?.message || action.error_message;

  return (
    <Card className="mt-3">
      <View style={styles.actionHeader}>
        <View style={[styles.actionIcon, { backgroundColor: status.backgroundColor }]}>
          {isDelete ? (
            <Trash2 size={20} color={status.color} />
          ) : action.action_type === "update" ? (
            <Pencil size={20} color={status.color} />
          ) : (
            <Plus size={21} color={status.color} />
          )}
        </View>
        <View style={styles.actionHeaderCopy}>
          <Text style={styles.actionTitle}>
            {action.summary?.title || "Proposta financeira"}
          </Text>
          <View style={styles.actionStatusRow}>
            <StatusIcon size={13} color={status.color} />
            <Text style={[styles.actionStatus, { color: status.color }]}>
              {action.status_label}
            </Text>
          </View>
        </View>
      </View>

      {rows.length ? (
        <View style={styles.actionRows}>
          {rows.map((row, index) => (
            <View key={`${row.label}-${index}`} style={styles.actionRow}>
              <Text style={styles.actionRowLabel}>{row.label}</Text>
              <Text style={styles.actionRowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {completionMessage ? (
        <Text style={[styles.actionFeedback, { color: status.color }]}>
          {completionMessage}
        </Text>
      ) : null}

      {isPending ? (
        <View style={styles.actionButtons}>
          <Pressable
            style={styles.actionSecondaryButton}
            onPress={() => onCancel(action)}
            disabled={busy}
          >
            <X size={16} color="#6C757D" />
            <Text style={styles.actionSecondaryText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={styles.actionSecondaryButton}
            onPress={() => onEdit(action)}
            disabled={busy}
          >
            <Pencil size={15} color="#0063f5" />
            <Text style={[styles.actionSecondaryText, { color: "#0063f5" }]}>
              Ajustar
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.actionPrimaryButton,
              isDelete && styles.actionDeleteButton,
              busy && styles.actionButtonDisabled,
            ]}
            onPress={() => onConfirm(action)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Check size={16} color="#ffffff" />
            )}
            <Text style={styles.actionPrimaryText}>Confirmar</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}


function Message({
  message,
  busyActionId,
  retryingMessageId,
  retryDisabled,
  onConfirmAction,
  onCancelAction,
  onEditAction,
  onRetry,
}) {
  if (message.role === "user") {
    return (
      <View className="mb-4 max-w-[90%] self-end rounded-[22px] rounded-tr-sm bg-[#dbe8ff] px-4 py-3">
        <Text className="font-poppins-regular text-[14px] leading-[21px] text-texto-primario">
          {message.content}
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-5 self-stretch">
      <MarkdownMessage content={message.content} isError={message.isError} />
      {message.isError && (message.retryMessageId || message.retryPrompt) ? (
        <Pressable
          style={styles.retryButton}
          onPress={() => onRetry(message)}
          disabled={retryDisabled}
          accessibilityRole="button"
          accessibilityLabel="Tentar enviar a pergunta novamente"
        >
          {retryingMessageId === message.id ? (
            <ActivityIndicator size="small" color="#0063f5" />
          ) : (
            <RotateCcw size={15} color="#0063f5" />
          )}
          <Text style={styles.retryButtonText}>
            {retryingMessageId === message.id
              ? "Tentando novamente…"
              : "Tentar novamente"}
          </Text>
        </Pressable>
      ) : null}
      {(message.actions || []).map((action) => (
        <PendingActionCard
          key={action.id}
          action={action}
          busy={busyActionId === action.id}
          onConfirm={onConfirmAction}
          onCancel={onCancelAction}
          onEdit={onEditAction}
        />
      ))}
    </View>
  );
}


function Conversation({
  messages,
  isLoading,
  isSending,
  title,
  onBack,
  scrollRef,
  busyActionId,
  retryingMessageId,
  onConfirmAction,
  onCancelAction,
  onEditAction,
  onRetry,
}) {
  return (
    <View className="flex-1">
      <View className="flex-row items-center px-4 pb-3 pt-3">
        <Pressable
          className="mr-2 flex-row items-center py-1"
          onPress={onBack}
          hitSlop={8}
        >
          <ArrowLeft size={14} color="#343A40" />
          <Text className="ml-1 font-poppins-medium text-xs text-texto-primario">
            Voltar
          </Text>
        </Pressable>
        <Text
          className="ml-2 flex-1 font-poppins-semibold text-sm text-texto-primario"
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#0063f5" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              busyActionId={busyActionId}
              retryingMessageId={retryingMessageId}
              retryDisabled={isSending}
              onConfirmAction={onConfirmAction}
              onCancelAction={onCancelAction}
              onEditAction={onEditAction}
              onRetry={onRetry}
            />
          ))}
          {isSending ? (
            <View className="mb-4 flex-row items-center">
              <ActivityIndicator size="small" color="#0063f5" />
              <Text className="ml-2 font-poppins-regular text-xs text-texto-terciario">
                Araris está consultando seus dados…
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}


function Composer({ value, onChangeText, onSend, onNewChat, disabled, bottomInset }) {
  const hasText = Boolean(value.trim());

  return (
    <View style={{ paddingBottom: bottomInset + 10 }} className="px-4 pt-4">
      <View className="flex-row items-end gap-3">
        <Pressable
          className="h-12 w-12 items-center justify-center rounded-full bg-[#f1f1f1] active:opacity-80"
          onPress={onNewChat}
          disabled={disabled}
          accessibilityLabel="Iniciar nova conversa"
        >
          <Plus size={28} color="#6C757D" strokeWidth={1.8} />
        </Pressable>
        <View className="min-h-12 flex-1 flex-row items-end rounded-[24px] bg-[#f1f1f1] px-4 py-1">
          <TextInput
            className="max-h-24 min-h-10 flex-1 py-2 font-poppins-regular text-[13px] text-texto-primario"
            placeholder="Escreva sua mensagem"
            placeholderTextColor="#7B8491"
            value={value}
            onChangeText={onChangeText}
            multiline
            editable={!disabled}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => hasText && !disabled && onSend()}
          />
          <Pressable
            className="h-10 w-9 items-center justify-center"
            onPress={() => hasText && onSend()}
            disabled={!hasText || disabled}
            accessibilityLabel="Enviar mensagem"
          >
            <Send
              size={21}
              color={hasText && !disabled ? "#0063f5" : "#9CA3AF"}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}


export default function Chatbot() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const keyboardScrollTimer = useRef(null);
  const { currentOrganization, loadSession, user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeTitle, setActiveTitle] = useState("Nova conversa");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isConversationVisible, setIsConversationVisible] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState(null);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const [busyActionId, setBusyActionId] = useState(null);
  const [error, setError] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setIsKeyboardVisible(true);
      if (keyboardScrollTimer.current) {
        clearTimeout(keyboardScrollTimer.current);
      }
      keyboardScrollTimer.current = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
        keyboardScrollTimer.current = null;
      }, Math.min(event.duration ?? 250, 300));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      if (keyboardScrollTimer.current) {
        clearTimeout(keyboardScrollTimer.current);
      }
    };
  }, []);

  const loadConversations = useCallback(
    async (showLoading = true) => {
      if (!currentOrganization?.id) {
        return;
      }

      try {
        if (showLoading) {
          setIsLoadingList(true);
        }
        setError("");
        const data = await listChatConversations(currentOrganization.id);
        setConversations(data);
      } catch (requestError) {
        if (requestError.status === 401) {
          await loadSession();
          return;
        }
        setError(
          requestError.message || "Não foi possível carregar suas conversas.",
        );
      } finally {
        if (showLoading) {
          setIsLoadingList(false);
        }
      }
    },
    [currentOrganization?.id, loadSession],
  );

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations]),
  );

  useEffect(() => {
    setActiveConversationId(null);
    setActiveTitle("Nova conversa");
    setMessages([]);
    setIsConversationVisible(false);
  }, [currentOrganization?.id]);

  async function openConversation(conversationId) {
    if (!currentOrganization?.id) {
      return;
    }

    setIsConversationVisible(true);
    setIsLoadingConversation(true);
    setError("");
    try {
      const data = await getChatConversation(
        currentOrganization.id,
        conversationId,
      );
      setActiveConversationId(data.id);
      setActiveTitle(data.title);
      setMessages(data.messages);
    } catch (requestError) {
      setError(requestError.message || "Não foi possível abrir esta conversa.");
      setIsConversationVisible(false);
    } finally {
      setIsLoadingConversation(false);
    }
  }

  function showOverview() {
    Keyboard.dismiss();
    setActiveConversationId(null);
    setActiveTitle("Nova conversa");
    setMessages([]);
    setIsConversationVisible(false);
    setError("");
    loadConversations(false);
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setActiveTitle("Nova conversa");
    setMessages([]);
    setInput("");
    setError("");
    setIsConversationVisible(false);
  }

  async function handleSend(prompt) {
    const content = (prompt ?? input).trim();
    if (!content || isSending || !currentOrganization?.id) {
      return;
    }
    const conversationId = isConversationVisible ? activeConversationId : null;

    const temporaryMessage = {
      id: `temporary-${Date.now()}`,
      role: "user",
      content,
    };
    setMessages((current) => [...current, temporaryMessage]);
    setInput("");
    setError("");
    setIsConversationVisible(true);
    setIsSending(true);

    try {
      const data = await sendChatMessage(
        currentOrganization.id,
        content,
        conversationId,
      );
      setActiveConversationId(data.id);
      setActiveTitle(data.title);
      setMessages(data.messages);
      await loadConversations(false);
    } catch (requestError) {
      const createdConversationId = requestError.data?.conversation_id;
      const retryMessageId = requestError.data?.user_message_id;
      if (createdConversationId) {
        setActiveConversationId(createdConversationId);
      }
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            requestError.message ||
            "Não consegui responder agora. Tente novamente em instantes.",
          isError: true,
          retryMessageId,
          retryPrompt: content,
        },
      ]);
      await loadConversations(false);
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteConversation(conversationId) {
    if (deletingConversationId || !currentOrganization?.id) {
      return;
    }

    setDeletingConversationId(conversationId);
    try {
      await deleteChatConversation(currentOrganization.id, conversationId);
      setConversations((current) =>
        current.filter((conversation) => conversation.id !== conversationId),
      );
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setActiveTitle("Nova conversa");
        setMessages([]);
      }
      await loadConversations(false);
    } catch (requestError) {
      Alert.alert(
        "Não foi possível excluir",
        requestError.message || "Tente novamente em instantes.",
      );
    } finally {
      setDeletingConversationId(null);
    }
  }

  function confirmDeleteConversation(conversation) {
    Alert.alert(
      "Excluir conversa",
      `Deseja excluir “${conversation.title || "Conversa com a Araris"}”?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => handleDeleteConversation(conversation.id),
        },
      ],
    );
  }

  async function handleRetry(message) {
    if (
      (!message.retryMessageId && !message.retryPrompt) ||
      isSending ||
      !currentOrganization?.id
    ) {
      return;
    }

    setRetryingMessageId(message.id);
    setIsSending(true);
    setError("");
    try {
      const data = message.retryMessageId
        ? await retryChatMessage(
            currentOrganization.id,
            message.retryMessageId,
          )
        : await sendChatMessage(
            currentOrganization.id,
            message.retryPrompt,
            activeConversationId,
          );
      setActiveConversationId(data.id);
      setActiveTitle(data.title);
      setMessages(data.messages);
      await loadConversations(false);
    } catch (requestError) {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? {
                ...item,
                content:
                  requestError.message ||
                  "Não consegui responder agora. Tente novamente em instantes.",
                retryMessageId:
                  requestError.data?.user_message_id || item.retryMessageId,
              }
            : item,
        ),
      );
    } finally {
      setRetryingMessageId(null);
      setIsSending(false);
    }
  }

  function updateAction(updatedAction) {
    setMessages((current) =>
      current.map((message) => ({
        ...message,
        actions: (message.actions || []).map((action) =>
          action.id === updatedAction.id ? updatedAction : action,
        ),
      })),
    );
  }

  async function refreshActiveConversation() {
    if (!currentOrganization?.id || !activeConversationId) {
      return;
    }
    const data = await getChatConversation(
      currentOrganization.id,
      activeConversationId,
    );
    setMessages(data.messages);
  }

  async function runActionRequest(action, operation) {
    if (busyActionId || !currentOrganization?.id) {
      return null;
    }
    setBusyActionId(action.id);
    try {
      const updatedAction = await operation(
        currentOrganization.id,
        action.id,
      );
      updateAction(updatedAction);
      await loadConversations(false);
      return updatedAction;
    } catch (requestError) {
      try {
        await refreshActiveConversation();
      } catch {
        // A mensagem de erro original é mais útil que uma falha de atualização.
      }
      Alert.alert(
        "Não foi possível concluir",
        requestError.message || "Tente novamente em instantes.",
      );
      return null;
    } finally {
      setBusyActionId(null);
    }
  }

  async function handleConfirmAction(action) {
    await runActionRequest(action, confirmChatAction);
  }

  async function handleCancelAction(action) {
    await runActionRequest(action, cancelChatAction);
  }

  async function handleEditAction(action) {
    const updatedAction = await runActionRequest(action, cancelChatAction);
    if (updatedAction) {
      setInput(
        action.summary?.edit_prompt ||
          "Quero ajustar essa proposta. As alterações são:",
      );
    }
  }

  const isOverview = !isConversationVisible;

  function leaveChatbot() {
    Keyboard.dismiss();
    router.replace("/(tabs)/home");
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: isOverview ? "#f9fafb" : "#ffffff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 80}
    >
      <View
        className="flex-1"
        style={{ backgroundColor: isOverview ? "#f9fafb" : "#ffffff" }}
      >
        {isOverview ? (
          <Overview
            name={firstName(user?.name)}
            conversations={conversations}
            isLoading={isLoadingList}
            error={error}
            deletingConversationId={deletingConversationId}
            onBack={leaveChatbot}
            onConversationPress={openConversation}
            onConversationDelete={confirmDeleteConversation}
            onSuggestionPress={handleSend}
          />
        ) : (
          <Conversation
            messages={messages}
            isLoading={isLoadingConversation}
            isSending={isSending}
            title={activeTitle}
            onBack={showOverview}
            scrollRef={scrollRef}
            busyActionId={busyActionId}
            retryingMessageId={retryingMessageId}
            onConfirmAction={handleConfirmAction}
            onCancelAction={handleCancelAction}
            onEditAction={handleEditAction}
            onRetry={handleRetry}
          />
        )}

        <View
          style={[
            styles.composerSurface,
            isOverview && styles.composerSurfaceOverview,
          ]}
        >
          <Composer
            value={input}
            onChangeText={setInput}
            onSend={handleSend}
            onNewChat={startNewConversation}
            disabled={isSending || Boolean(busyActionId)}
            bottomInset={isKeyboardVisible ? 0 : insets.bottom}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  overviewContent: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  messagesContent: {
    paddingHorizontal: 14,
    paddingBottom: 18,
    paddingTop: 10,
  },
  composerSurface: {
    backgroundColor: "#ffffff",
    borderTopColor: "#f3f4f6",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
  },
  composerSurfaceOverview: {
    backgroundColor: "transparent",
    borderTopWidth: 0,
  },
  sectionTitle: {
    color: "#343A40",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    lineHeight: 25,
    marginBottom: 12,
  },
  cardList: {
    gap: 12,
  },
  conversationSwipeable: {
    overflow: "visible",
  },
  conversationDeleteAction: {
    alignItems: "center",
    backgroundColor: "#dc2626",
    borderRadius: 16,
    justifyContent: "center",
    marginLeft: 8,
    width: 76,
  },
  conversationDeleteText: {
    color: "#ffffff",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    marginTop: 3,
  },
  cardRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "nowrap",
    width: "100%",
  },
  chatCardIcon: {
    alignItems: "center",
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    flexShrink: 0,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  chatCardCopy: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  chatCardTitle: {
    color: "#343A40",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    lineHeight: 19,
  },
  chatCardPreview: {
    color: "#6C757D",
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  suggestionIcon: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    flexShrink: 0,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  markdownBody: {
    gap: 8,
  },
  markdownText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    lineHeight: 22,
  },
  markdownStrong: {
    fontFamily: "Poppins_600SemiBold",
  },
  markdownEmphasis: {
    fontFamily: "Poppins_400Regular_Italic",
  },
  markdownStrike: {
    textDecorationLine: "line-through",
  },
  markdownInlineCode: {
    backgroundColor: "#eef2f7",
    color: "#162A94",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
  },
  markdownLink: {
    color: "#0063f5",
    textDecorationLine: "underline",
  },
  markdownHeading: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 3,
  },
  markdownHeading1: {
    fontSize: 18,
    lineHeight: 24,
  },
  markdownHeading2: {
    fontSize: 16,
    lineHeight: 22,
  },
  markdownListRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    paddingRight: 4,
  },
  markdownListMarker: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    lineHeight: 22,
    minWidth: 21,
  },
  markdownListText: {
    flex: 1,
  },
  markdownDivider: {
    backgroundColor: "#d1d5db",
    height: StyleSheet.hairlineWidth,
    marginVertical: 3,
  },
  markdownQuote: {
    backgroundColor: "#f7f9fc",
    borderLeftColor: "#0063f5",
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  markdownCodeBlock: {
    backgroundColor: "#eef2f7",
    borderRadius: 10,
    padding: 10,
  },
  markdownCodeText: {
    color: "#343A40",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    lineHeight: 18,
  },
  retryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#eef5ff",
    borderColor: "#cfe1ff",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  retryButtonText: {
    color: "#0063f5",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
  actionHeader: {
    alignItems: "center",
    flexDirection: "row",
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  actionHeaderCopy: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    color: "#343A40",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
  actionStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
  },
  actionStatus: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    lineHeight: 16,
  },
  actionRows: {
    borderTopColor: "#edf0f3",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 7,
    marginTop: 13,
    paddingTop: 12,
  },
  actionRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  actionRowLabel: {
    color: "#6C757D",
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    lineHeight: 17,
  },
  actionRowValue: {
    color: "#343A40",
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "right",
  },
  actionFeedback: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 7,
    marginTop: 14,
  },
  actionSecondaryButton: {
    alignItems: "center",
    backgroundColor: "#f5f6f8",
    borderRadius: 10,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 9,
  },
  actionSecondaryText: {
    color: "#6C757D",
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  actionPrimaryButton: {
    alignItems: "center",
    backgroundColor: "#0063f5",
    borderRadius: 10,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10,
  },
  actionDeleteButton: {
    backgroundColor: "#d92d3f",
  },
  actionButtonDisabled: {
    opacity: 0.65,
  },
  actionPrimaryText: {
    color: "#ffffff",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
  },
});
