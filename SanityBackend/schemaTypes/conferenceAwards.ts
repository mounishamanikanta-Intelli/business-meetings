import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'conferenceAwards',
  title: 'Conference Awards',
  type: 'document',
  icon: () => '🏅',

  fields: [
    defineField({
      name: 'awardName',
      title: 'Award Name',
      type: 'string',
      validation: Rule => Rule.required().min(2).max(200),
    }),

    defineField({
      name: 'awardImage',
      title: 'Award Image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          title: 'Alt Text',
          type: 'string',
        }
      ],
      validation: Rule => Rule.required(),
    }),

    defineField({
      name: 'description',
      title: 'About the Award',
      type: 'text',
      validation: Rule => Rule.max(300),
    })
  ],

  preview: {
    select: {
      title: 'awardName',
      media: 'awardImage', // ✅ FIXED
    },
    prepare({ title, media }) {
      return {
        title,
        subtitle: 'Award',
        media,
      }
    }
  },
})
