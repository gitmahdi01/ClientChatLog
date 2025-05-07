// Get the client name from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const clientName = urlParams.get('client');

// Set the page title to include client name
document.title = clientName ? `Chat History - ${clientName}` : 'Chat History';

// Add client name to the header
const headerElement = document.querySelector('h1');
if (headerElement && clientName) {
  headerElement.innerHTML = `<a href="index.html">back</a> - ${clientName}`;
}

const chatContainer = document.getElementById("chat-container");

// Function to get this specific client's chats
function getClientChats() {
  if (!clientName) return [];
  
  // Get all chat history organized by client
  const allChats = JSON.parse(localStorage.getItem("allChatHistory")) || {};
  
  // Return only this client's chats (or empty array if none exist)
  return allChats[clientName] || [];
}

// Function to save this client's chats
function saveClientChats(clientChats) {
  if (!clientName) return;
  
  // Get current state of all chats
  const allChats = JSON.parse(localStorage.getItem("allChatHistory")) || {};
  
  // Update just this client's chats
  allChats[clientName] = clientChats;
  
  // Save back to localStorage
  localStorage.setItem("allChatHistory", JSON.stringify(allChats));
}

function renderChats() {
  chatContainer.innerHTML = "";
  
  if (!clientName) {
    chatContainer.innerHTML = "<p>No client selected. Please go back and select a client.</p>";
    document.getElementById("new-chat-btn").disabled = true;
    document.getElementById("export-btn").disabled = true;
    document.getElementById("Delete-message").disabled = true;
    document.getElementById("clear-messages").disabled = true;
    return;
  }

  // Get only this client's chats
  const clientChats = getClientChats();
  
  if (clientChats.length === 0) {
    chatContainer.innerHTML = "<p>No chat history for this client yet.</p>";
  } else {
    // Sort chats by date (newest first)
    clientChats.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    clientChats.forEach(chat => {
      const box = document.createElement("div");
      box.className = "chat-box";
      box.innerHTML = `
        <strong>Date:</strong> ${chat.date}<br/>
        <strong>Message:</strong> ${chat.message}
      `;
      chatContainer.appendChild(box);
    });
  }
}

function addNewChat() {
  if (!clientName) {
    alert("No client selected. Please go back and select a client.");
    return;
  }

  const date = prompt("Enter the date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
  if (!date || isNaN(Date.parse(date))) {
    alert("Invalid date format.");
    return;
  }

  const message = prompt("Enter the chat message:");
  if (!message || message.trim() === "") {
    alert("Message cannot be empty.");
    return;
  }

  // Get current chats for this client
  const clientChats = getClientChats();
  
  // Add the new chat
  clientChats.push({ date, message });
  
  // Save back to localStorage
  saveClientChats(clientChats);
  
  // Re-render the chat display
  renderChats();
}

document.getElementById("new-chat-btn").addEventListener("click", addNewChat);

// Delete specific message functionality
function deleteMessage() {
  if (!clientName) {
    alert("No client selected. Please go back and select a client.");
    return;
  }
  
  // Get current chats for this client
  const clientChats = getClientChats();
  
  if (clientChats.length === 0) {
    alert("This client has no chat messages to delete.");
    return;
  }
  
  // Prompt for date of message to delete
  const dateToDelete = prompt("Enter the date (YYYY-MM-DD) of the message you want to delete:");
  
  if (!dateToDelete || dateToDelete.trim() === "") {
    alert("No date entered. No message was deleted.");
    return;
  }
  
  // Find all messages with that date
  const messagesOnDate = clientChats.filter(chat => chat.date === dateToDelete.trim());
  
  if (messagesOnDate.length === 0) {
    alert(`No messages found for date "${dateToDelete}".`);
    return;
  }
  
  // If multiple messages on the same date, ask which one to delete
  let messageIndex = 0;
  if (messagesOnDate.length > 1) {
    let messageOptions = "Multiple messages found for this date. Enter the number of the message you want to delete:\n\n";
    messagesOnDate.forEach((msg, idx) => {
      messageOptions += `${idx + 1}. ${msg.message.substring(0, 50)}${msg.message.length > 50 ? '...' : ''}\n`;
    });
    
    const selection = prompt(messageOptions);
    if (!selection || isNaN(parseInt(selection)) || parseInt(selection) < 1 || parseInt(selection) > messagesOnDate.length) {
      alert("Invalid selection. No message was deleted.");
      return;
    }
    
    messageIndex = parseInt(selection) - 1;
  }
  
  // Confirm before deleting
  const messageToDelete = messagesOnDate[messageIndex];
  const confirmDelete = confirm(`Are you sure you want to delete this message?\n\nDate: ${messageToDelete.date}\nMessage: ${messageToDelete.message}`);
  
  if (!confirmDelete) {
    return;
  }
  
  // Remove the message
  const updatedChats = clientChats.filter(chat => 
    !(chat.date === messageToDelete.date && chat.message === messageToDelete.message)
  );
  
  // Save updated chats
  saveClientChats(updatedChats);
  
  // Re-render the chat display
  renderChats();
  
  alert("Message deleted successfully.");
}

// Clear all messages functionality
function clearAllMessages() {
  if (!clientName) {
    alert("No client selected. Please go back and select a client.");
    return;
  }
  
  const clientChats = getClientChats();
  
  if (clientChats.length === 0) {
    alert("This client has no chat messages to clear.");
    return;
  }
  
  // Confirm before clearing all
  const confirmClear = confirm(`Are you sure you want to delete ALL chat messages for ${clientName}? This cannot be undone.`);
  
  if (!confirmClear) {
    return;
  }
  
  // Clear all messages for this client
  saveClientChats([]);
  
  // Re-render the chat display
  renderChats();
  
  alert("All messages cleared successfully.");
}

document.getElementById("Delete-message").addEventListener("click", deleteMessage);
document.getElementById("clear-messages").addEventListener("click", clearAllMessages);

// Export functionality
document.getElementById("export-btn").addEventListener("click", async () => {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF; // support fallback
  if (!jsPDF) {
    alert("jsPDF library not loaded. Please check your internet connection or CDN.");
    return;
  }
  
  if (!clientName) {
    alert("No client selected. Please go back and select a client.");
    return;
  }

  // Get this client's chats only
  const clientChats = getClientChats();

  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text(`Chat History - ${clientName}`, 10, 10);
  
  let y = 20;
  doc.setFontSize(12);

  if (clientChats.length === 0) {
    doc.text("No chat history available.", 10, y);
  } else {
    clientChats.forEach((chat, index) => {
      const text = `Date: ${chat.date} | Record: ${chat.message}`;
      
      // Check if text will fit on current page
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(text, 10, y);
      y += 10;
    });
  }

  doc.save(`${clientName}-chat-history.pdf`);
});

// Initial display
renderChats();