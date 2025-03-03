import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Badge,
  VStack,
  HStack,
  Spacer,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tooltip,
  useToast,
  Tag,
  TagLabel,
  TagLeftIcon,
  TagCloseButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Input,
  Select,
  FormControl,
  FormLabel,
  Spinner,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  PopoverArrow,
  PopoverCloseButton,
} from "@chakra-ui/react";
import {
  CheckIcon,
  AddIcon,
  CloseIcon,
  ChevronDownIcon,
  EditIcon,
  DeleteIcon,
  StarIcon,
  QuestionIcon,
} from "@chakra-ui/icons";

import {
  initializeDefaultLabels,
  getLabelCategories,
  getLabels,
  getLabelsByCategory,
  getThreadLabels,
  addLabelToThread,
  removeLabelFromThread,
  confirmThreadLabel,
  suggestLabelsForThread,
  addLabelFeedback,
  createLabel,
  updateLabel,
  deleteLabel,
} from "../lib/api";

// Component for displaying label suggestions
export const LabelSuggestions = ({ threadId, onLabelApplied }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  // Fetch suggestions when thread ID changes
  useEffect(() => {
    if (threadId) {
      fetchSuggestions();
    }
  }, [threadId]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await suggestLabelsForThread(threadId);
      setSuggestions(response.data.suggestions);
    } catch (err) {
      console.error("Error fetching label suggestions:", err);
      setError("Failed to load label suggestions");
      toast({
        title: "Error",
        description: "Failed to load label suggestions",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyLabel = async (labelId, confidence) => {
    try {
      await addLabelToThread(threadId, labelId, confidence, true);
      toast({
        title: "Label Applied",
        description: "The label has been applied to this thread",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Remove from suggestions
      setSuggestions(suggestions.filter((s) => s.label_id !== labelId));

      // Notify parent component
      if (onLabelApplied) {
        onLabelApplied();
      }
    } catch (err) {
      console.error("Error applying label:", err);
      toast({
        title: "Error",
        description: "Failed to apply label",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleRejectLabel = async (labelId) => {
    try {
      // Remove from suggestions
      setSuggestions(suggestions.filter((s) => s.label_id !== labelId));

      // Add feedback
      await addLabelFeedback(threadId, labelId);

      toast({
        title: "Label Rejected",
        description: "Thanks for your feedback",
        status: "info",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error("Error rejecting label:", err);
    }
  };

  if (loading) {
    return (
      <Box p={4}>
        <Flex align="center">
          <Spinner size="sm" mr={2} />
          <Text>Getting smart label suggestions...</Text>
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Text color="red.500">{error}</Text>
      </Box>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <Box p={4}>
        <Text fontSize="sm" color="gray.500">
          No label suggestions available
        </Text>
      </Box>
    );
  }

  return (
    <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
      <Heading size="sm" mb={3}>
        Suggested Labels
      </Heading>
      <VStack spacing={2} align="stretch">
        {suggestions.map((suggestion) => (
          <Flex
            key={suggestion.label_id}
            p={2}
            borderWidth="1px"
            borderRadius="md"
            bg="white"
            align="center"
          >
            <Box flex="1">
              <Badge colorScheme={getColorScheme(suggestion.color)} mr={2}>
                {suggestion.category_name}
              </Badge>
              <Text display="inline" fontWeight="medium">
                {suggestion.name}
              </Text>
              <Text fontSize="xs" color="gray.500" mt={1}>
                {suggestion.confidence}% confidence match
              </Text>
            </Box>
            <HStack>
              <Tooltip label="Apply this label">
                <IconButton
                  icon={<CheckIcon />}
                  size="sm"
                  colorScheme="green"
                  variant="outline"
                  aria-label="Apply label"
                  onClick={() =>
                    handleApplyLabel(suggestion.label_id, suggestion.confidence)
                  }
                />
              </Tooltip>
              <Tooltip label="Reject this label">
                <IconButton
                  icon={<CloseIcon />}
                  size="sm"
                  colorScheme="red"
                  variant="outline"
                  aria-label="Reject label"
                  onClick={() => handleRejectLabel(suggestion.label_id)}
                />
              </Tooltip>
            </HStack>
          </Flex>
        ))}
      </VStack>
    </Box>
  );
};

// Component for displaying applied labels on a thread
export const ThreadLabels = ({ threadId, onLabelRemoved }) => {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allLabels, setAllLabels] = useState([]);
  const [categories, setCategories] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryLabels, setCategoryLabels] = useState([]);
  const toast = useToast();

  useEffect(() => {
    if (threadId) {
      fetchLabels();
      fetchAllLabelsAndCategories();
    }
  }, [threadId]);

  const fetchLabels = async () => {
    setLoading(true);
    try {
      const response = await getThreadLabels(threadId);
      setLabels(response.data);
    } catch (err) {
      console.error("Error fetching thread labels:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLabelsAndCategories = async () => {
    try {
      const [labelsResponse, categoriesResponse] = await Promise.all([
        getLabels(),
        getLabelCategories(),
      ]);
      setAllLabels(labelsResponse.data);
      setCategories(categoriesResponse.data);
    } catch (err) {
      console.error("Error fetching labels and categories:", err);
    }
  };

  const handleCategoryChange = async (categoryId) => {
    setSelectedCategory(categoryId);
    if (categoryId) {
      try {
        const response = await getLabelsByCategory(categoryId);
        setCategoryLabels(response.data);
      } catch (err) {
        console.error("Error fetching category labels:", err);
        setCategoryLabels([]);
      }
    } else {
      setCategoryLabels([]);
    }
  };

  const handleRemoveLabel = async (labelId) => {
    try {
      await removeLabelFromThread(threadId, labelId);
      setLabels(labels.filter((label) => label.label_id !== labelId));

      toast({
        title: "Label Removed",
        description: "The label has been removed from this thread",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      if (onLabelRemoved) {
        onLabelRemoved();
      }
    } catch (err) {
      console.error("Error removing label:", err);
      toast({
        title: "Error",
        description: "Failed to remove label",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleAddLabel = async (labelId) => {
    try {
      const response = await addLabelToThread(threadId, labelId, 100, true);

      // Add new label to the list
      const newLabel = allLabels.find((l) => l.id === labelId);
      if (newLabel) {
        setLabels([
          ...labels,
          {
            ...response.data,
            label: newLabel,
          },
        ]);
      }

      toast({
        title: "Label Added",
        description: "The label has been added to this thread",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      onClose();
    } catch (err) {
      console.error("Error adding label:", err);
      toast({
        title: "Error",
        description: "Failed to add label",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <>
      <Box>
        <Flex align="center" mb={2}>
          <Heading size="sm">Labels</Heading>
          <Spacer />
          <Button
            leftIcon={<AddIcon />}
            size="xs"
            variant="outline"
            onClick={onOpen}
          >
            Add
          </Button>
        </Flex>

        {loading ? (
          <Spinner size="sm" />
        ) : labels.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            No labels applied
          </Text>
        ) : (
          <Flex wrap="wrap" gap={2}>
            {labels.map((item) => (
              <Tag
                key={item.id}
                size="md"
                borderRadius="full"
                variant="solid"
                colorScheme={getColorScheme(item.label.color)}
              >
                <TagLabel>{item.label.name}</TagLabel>
                <TagCloseButton
                  onClick={() => handleRemoveLabel(item.label_id)}
                />
              </Tag>
            ))}
          </Flex>
        )}
      </Box>

      {/* Add Label Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Label to Thread</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel>Category</FormLabel>
              <Select
                placeholder="Select category"
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </FormControl>

            {selectedCategory && (
              <FormControl>
                <FormLabel>Label</FormLabel>
                <VStack
                  align="stretch"
                  spacing={2}
                  maxH="200px"
                  overflowY="auto"
                >
                  {categoryLabels.length === 0 ? (
                    <Text fontSize="sm" color="gray.500">
                      No labels in this category
                    </Text>
                  ) : (
                    categoryLabels.map((label) => (
                      <Button
                        key={label.id}
                        justifyContent="space-between"
                        leftIcon={
                          <Box
                            w={3}
                            h={3}
                            bg={label.color || "#808080"}
                            borderRadius="full"
                          />
                        }
                        variant="outline"
                        onClick={() => handleAddLabel(label.id)}
                        isDisabled={labels.some((l) => l.label_id === label.id)}
                      >
                        {label.name}
                        {labels.some((l) => l.label_id === label.id) && (
                          <Text fontSize="xs" color="gray.500">
                            (Already applied)
                          </Text>
                        )}
                      </Button>
                    ))
                  )}
                </VStack>
              </FormControl>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

// Component for managing label categories and labels
export const LabelManager = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryLabels, setCategoryLabels] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#808080");
  const [editingLabel, setEditingLabel] = useState(null);
  const toast = useToast();

  useEffect(() => {
    initializeAndFetchCategories();
  }, []);

  const initializeAndFetchCategories = async () => {
    setLoading(true);
    try {
      // Initialize default labels
      await initializeDefaultLabels();

      // Fetch categories
      const response = await getLabelCategories();
      setCategories(response.data);

      // Select first category if available
      if (response.data.length > 0) {
        handleSelectCategory(response.data[0].id);
      }
    } catch (err) {
      console.error("Error initializing labels:", err);
      toast({
        title: "Error",
        description: "Failed to initialize labels",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = async (categoryId) => {
    setSelectedCategory(categoryId);
    try {
      const response = await getLabelsByCategory(categoryId);
      setCategoryLabels(response.data);
    } catch (err) {
      console.error("Error fetching category labels:", err);
      setCategoryLabels([]);
    }
  };

  const handleOpenCreateLabel = () => {
    setEditingLabel(null);
    setNewLabelName("");
    setNewLabelColor("#808080");
    onOpen();
  };

  const handleOpenEditLabel = (label) => {
    setEditingLabel(label);
    setNewLabelName(label.name);
    setNewLabelColor(label.color);
    onOpen();
  };

  const handleSaveLabel = async () => {
    if (!newLabelName.trim()) {
      toast({
        title: "Error",
        description: "Label name cannot be empty",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      if (editingLabel) {
        // Update existing label
        await updateLabel(editingLabel.id, {
          name: newLabelName,
          color: newLabelColor,
        });

        toast({
          title: "Label Updated",
          description: "The label has been updated successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Create new label
        await createLabel({
          name: newLabelName,
          category_id: selectedCategory,
          color: newLabelColor,
        });

        toast({
          title: "Label Created",
          description: "The new label has been created successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }

      // Refresh labels
      const response = await getLabelsByCategory(selectedCategory);
      setCategoryLabels(response.data);

      onClose();
    } catch (err) {
      console.error("Error saving label:", err);
      toast({
        title: "Error",
        description: `Failed to ${editingLabel ? "update" : "create"} label`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDeleteLabel = async (labelId) => {
    try {
      await deleteLabel(labelId);

      // Refresh labels
      setCategoryLabels(categoryLabels.filter((label) => label.id !== labelId));

      toast({
        title: "Label Deleted",
        description: "The label has been deleted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error("Error deleting label:", err);
      toast({
        title: "Error",
        description: "Failed to delete label",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  if (loading) {
    return (
      <Box p={4} textAlign="center">
        <Spinner />
        <Text mt={2}>Loading labels...</Text>
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Heading size="md" mb={4}>
        Label Management
      </Heading>

      {/* Category Tabs */}
      <Flex mb={4} overflow="auto">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "solid" : "outline"}
            colorScheme="blue"
            mr={2}
            onClick={() => handleSelectCategory(category.id)}
          >
            {category.name}
          </Button>
        ))}
      </Flex>

      {/* Labels in Selected Category */}
      {selectedCategory && (
        <>
          <Flex justify="space-between" align="center" mb={4}>
            <Heading size="sm">
              {categories.find((c) => c.id === selectedCategory)?.name} Labels
            </Heading>
            <Button
              size="sm"
              leftIcon={<AddIcon />}
              colorScheme="green"
              onClick={handleOpenCreateLabel}
            >
              New Label
            </Button>
          </Flex>

          <VStack align="stretch" spacing={3}>
            {categoryLabels.length === 0 ? (
              <Text color="gray.500">No labels in this category</Text>
            ) : (
              categoryLabels.map((label) => (
                <Flex
                  key={label.id}
                  p={3}
                  borderWidth="1px"
                  borderRadius="md"
                  align="center"
                >
                  <Box
                    w={4}
                    h={4}
                    bg={label.color || "#808080"}
                    borderRadius="full"
                    mr={3}
                  />
                  <Text fontWeight="medium">{label.name}</Text>
                  <Spacer />
                  <HStack>
                    <IconButton
                      icon={<EditIcon />}
                      size="sm"
                      variant="ghost"
                      aria-label="Edit label"
                      onClick={() => handleOpenEditLabel(label)}
                    />
                    <IconButton
                      icon={<DeleteIcon />}
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      aria-label="Delete label"
                      onClick={() => handleDeleteLabel(label.id)}
                    />
                  </HStack>
                </Flex>
              ))
            )}
          </VStack>
        </>
      )}

      {/* Create/Edit Label Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingLabel ? "Edit Label" : "Create New Label"}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel>Label Name</FormLabel>
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Enter label name"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Color</FormLabel>
              <Flex>
                <Box w={8} h={8} bg={newLabelColor} borderRadius="md" mr={3} />
                <Input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                />
              </Flex>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveLabel}>
              {editingLabel ? "Update" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

// Helper function to convert hex color to Chakra UI color scheme
const getColorScheme = (hexColor) => {
  // Default color scheme mapping
  const colorMap = {
    "#4285F4": "blue",
    "#EA4335": "red",
    "#34A853": "green",
    "#FBBC05": "yellow",
    "#808080": "gray",
  };

  return colorMap[hexColor] || "blue";
};
