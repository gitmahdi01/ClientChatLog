const clientsDiv = document.getElementById("clients");
let clients = JSON.parse(localStorage.getItem("clients")) || [];

function renderClients() {
  clientsDiv.innerHTML = "";
  clients.forEach((clientName) => {
    const btn = document.createElement("button");
    btn.textContent = clientName;
    btn.className = "client-btn";
    btn.onclick = () => {
      // Fixed URL format with correct template literal syntax
      window.location.href = `ChatHistory.html?client=${encodeURIComponent(clientName)}`;
    };
    clientsDiv.appendChild(btn);
  });
}

function addClient() {
  const name = prompt("Enter the new client's name:");
  if (name && name.trim() !== "") {
    clients.push(name.trim());
    localStorage.setItem("clients", JSON.stringify(clients));
    renderClients();
  } else {
    alert("Invalid name. Try again.");
  }
}

function removeClient() {
  if (clients.length === 0) {
    alert("No clients to remove.");
    return;
  }
  
  // Prompt for client name to remove
  const nameToRemove = prompt("Enter the name of the client you want to remove:");
  
  if (!nameToRemove || nameToRemove.trim() === "") {
    alert("No name entered. No client was removed.");
    return;
  }
  
  // Find the client in the list
  const clientIndex = clients.findIndex(
    client => client.toLowerCase() === nameToRemove.trim().toLowerCase()
  );
  
  if (clientIndex === -1) {
    alert(`Client "${nameToRemove}" not found.`);
    return;
  }
  
  // Confirm before removing
  const confirmRemove = confirm(`Are you sure you want to remove client "${clients[clientIndex]}"?`);
  if (!confirmRemove) {
    return;
  }
  
  // Remove client
  clients.splice(clientIndex, 1);
  
  // Also remove their chat history
  const allChats = JSON.parse(localStorage.getItem("allChatHistory")) || {};
  const clientName = clients[clientIndex];
  if (allChats[clientName]) {
    delete allChats[clientName];
    localStorage.setItem("allChatHistory", JSON.stringify(allChats));
  }
  
  // Save updated client list
  localStorage.setItem("clients", JSON.stringify(clients));
  renderClients();
}

// Add search functionality
const searchInput = document.querySelector('input[type="search"]');
searchInput.addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  
  clientsDiv.innerHTML = "";
  clients.forEach((clientName) => {
    // Only show clients that match search term
    if (clientName.toLowerCase().includes(searchTerm)) {
      const btn = document.createElement("button");
      btn.textContent = clientName;
      btn.className = "client-btn";
      btn.onclick = () => {
        window.location.href = `ChatHistory.html?client=${encodeURIComponent(clientName)}`;
      };
      clientsDiv.appendChild(btn);
    }
  });
});

document.getElementById("add-client-btn").addEventListener("click", addClient);
document.getElementById("remove-client-btn").addEventListener("click", removeClient);

renderClients();