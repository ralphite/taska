// T512, B515: Input box > Pictures and files: what you add to the box before you send; the box alone, in an item. The
// parts module draws them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as InputBox from '../parts/InputBox'

const meta: Meta = { title: 'Components/Input box/Pictures and files' }
export default meta

export const WithPictures: StoryObj = { ...InputBox.WithPictures, name: 'Two pictures' }
export const PictureUploading: StoryObj = { ...InputBox.PictureUploading, name: 'A picture going up' }
export const AFile: StoryObj = { ...InputBox.AFile, name: 'A file' }
export const ManyPictures: StoryObj = { ...InputBox.ManyPictures, name: 'More than fit: they scroll sideways' }
